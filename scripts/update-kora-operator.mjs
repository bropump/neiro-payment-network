// Update an existing Docker operator to the latest published official main image.
// Preserve private configuration, keys, ports and startup arguments. No Kora patch.
import {resolveMain} from './resolve-kora-main.mjs';
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';

const args=process.argv.slice(2);
let name='neiro-provider', state=resolve('work/operator-updates'), lockPath, healthUrl;
for(let i=0;i<args.length;i+=2) {
  if(!args[i+1]) throw new Error('Missing option value');
  if(args[i]==='--container') name=args[i+1];
  else if(args[i]==='--state-dir') state=resolve(args[i+1]);
  else if(args[i]==='--candidate-lock') lockPath=resolve(args[i+1]);
  else if(args[i]==='--health-url') healthUrl=args[i+1];
  else throw new Error('Usage: update-kora-operator.mjs [--container NAME] [--state-dir PATH]');
}
if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) throw new Error('Invalid container name');
mkdirSync(state,{recursive:true,mode:0o700});
const mutex=resolve(state,name+'.lock');
let acquired=false;
function run(args,options={}) {
  try {return execFileSync('docker',args,{encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe'],...options});}
  catch {throw new Error(`Docker ${args[0]} operation failed; no credentials or startup arguments were logged`);}
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let socketPath;
function engine(method,path,body) {
  return new Promise((resolve,reject)=>{
    const request=http.request({socketPath,method,path,headers:{'Content-Type':'application/json'}},response=>{
      let data='';response.on('data',chunk=>data+=chunk);
      response.on('end',()=>{
        if(response.statusCode>=300) {reject(new Error(`Docker engine HTTP ${response.statusCode}`));return;}
        try {resolve(data?JSON.parse(data):{});} catch {reject(new Error('Invalid Docker engine response'));}
      });
    });
    request.setTimeout(30000,()=>request.destroy(new Error('Docker engine timeout')));
    request.on('error',()=>reject(new Error('Docker engine connection failed')));
    request.end(body===undefined?undefined:JSON.stringify(body));
  });
}
async function healthy(url,env,timeout=45000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) {
    try {
      const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
        headers:{'Content-Type':'application/json',...(env.KORA_API_KEY?{'x-api-key':env.KORA_API_KEY}:{})},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getVersion',params:{}})});
      const result=await response.json();
      if(response.ok && typeof result.result?.version==='string') return;
    } catch {}
    await pause(500);
  }
  throw new Error('Updated operator failed its local getVersion health check');
}
async function main() {
  try {mkdirSync(mutex,{mode:0o700});acquired=true;writeFileSync(resolve(mutex,'pid'),String(process.pid));}
  catch {
    try {process.kill(Number(readFileSync(resolve(mutex,'pid'),'utf8')),0);}
    catch {rmSync(mutex,{recursive:true,force:true});mkdirSync(mutex,{mode:0o700});acquired=true;writeFileSync(resolve(mutex,'pid'),String(process.pid));}
    if(!acquired) {console.log('An operator update is already running');return;}
  }
  const context=JSON.parse(run(['context','inspect','--format','{{json .Endpoints.docker.Host}}']));
  if(!context.startsWith('unix://')) throw new Error('This updater requires a local Docker Unix socket');
  socketPath=context.slice(7);
  const before=await engine('GET',`/containers/${name}/json`);
  if(!before.State.Running) throw new Error('Operator is stopped; updater will not start it automatically');
  const pin=lockPath?JSON.parse(readFileSync(lockPath,'utf8')):await resolveMain();
  if(pin.channel!=='main' || !/^ghcr\.io\/solana-foundation\/kora@sha256:[a-f0-9]{64}$/.test(pin.image))
    throw new Error('Invalid official main pin');
  if(before.Config.Image===pin.image) {console.log(`Current: ${name} ${pin.upstream_commit}`);return;}
  run(['pull','--platform','linux/amd64',pin.image]);
  const env=Object.fromEntries(before.Config.Env.map(value=>{const index=value.indexOf('=');return [value.slice(0,index),value.slice(index+1)];}));
  const config=before.Config.Cmd??[];
  const option=(flag,fallback)=>{const i=config.indexOf(flag);return i<0?fallback:config[i+1];};
  const validate=['run','--rm','--platform','linux/amd64','--network','none','--read-only','--tmpfs','/tmp'];
  for(const key of Object.keys(env).filter(key=>key!=='PATH')) validate.push('-e',key);
  for(const mount of before.Mounts) {
    if(!['bind','volume'].includes(mount.Type)) throw new Error('Unsupported mount type; original operator remains running');
    const source=mount.Type==='volume'?mount.Name:mount.Source;
    if(source.includes(',') || mount.Destination.includes(',')) throw new Error('Unsupported comma in mount path');
    validate.push('--mount',`type=${mount.Type},src=${source},dst=${mount.Destination},readonly`);
  }
  validate.push('--entrypoint','kora',pin.image,'--config',option('--config','/config/kora.toml'),
    'config','validate','--signers-config',option('--signers-config','/config/signers.toml'));
  run(validate,{env:{...process.env,...env,PATH:process.env.PATH,RPC_URL:'http://127.0.0.1:8899'}});
  const binding=before.HostConfig.PortBindings?.['8080/tcp']?.[0];
  if(!binding) throw new Error('Local port 8080 mapping is required for the health check');
  const host=['','0.0.0.0','::'].includes(binding.HostIp)?'127.0.0.1':binding.HostIp;
  const health=healthUrl ?? `http://${host}:${binding.HostPort}`;
  const backup=name+'-rollback-'+Date.now();
  const originalRestart=before.HostConfig.RestartPolicy;
  let created=false;
  try {
    await engine('POST',`/containers/${before.Id}/update`,{RestartPolicy:{Name:'no'}});
    await engine('POST',`/containers/${before.Id}/stop?t=20`);
    await engine('POST',`/containers/${before.Id}/rename?name=${backup}`);
    const keys=['Hostname','Domainname','User','AttachStdin','AttachStdout','AttachStderr','ExposedPorts','Tty',
      'OpenStdin','StdinOnce','Env','Cmd','Volumes','WorkingDir','Entrypoint','Labels','StopSignal','StopTimeout','Healthcheck'];
    const body=Object.fromEntries(keys.filter(k=>before.Config[k]!==undefined).map(k=>[k,before.Config[k]]));
    const imageMetadata=JSON.parse(run(['image','inspect',pin.image]))[0];
    body.Image=pin.image;body.HostConfig=before.HostConfig;
    body.HostConfig.RestartPolicy=originalRestart;
    // Replace old image labels with the new official image labels; retain custom labels.
    body.Labels={...body.Labels,...imageMetadata.Config.Labels};
    body.Labels['com.neiro.main-updater.original-container']=before.Id;
    await engine('POST',`/containers/create?name=${name}&platform=linux/amd64`,body);created=true;
    await engine('POST',`/containers/${name}/start`);
    await healthy(health,env);
    const after=await engine('GET',`/containers/${name}/json`);
    if(after.Config.Image!==pin.image || after.Config.Env.join('\n')!==before.Config.Env.join('\n'))
      throw new Error('Image or private environment preservation check failed');
    let prior;
    try {prior=JSON.parse(readFileSync(resolve(state,name+'.json'),'utf8'));} catch {}
    writeFileSync(resolve(state,name+'.json'),JSON.stringify({updated_at:new Date().toISOString(),
      image:pin.image,upstream_commit:pin.upstream_commit,rollback_container:backup,health_check:'passed'},null,2)+'\n',{mode:0o600});
    console.log(`Updated: ${name} ${pin.upstream_commit}; rollback container ${backup}`);
    if(prior?.rollback_container?.startsWith(name+'-rollback-') && prior.rollback_container!==backup) {
      try {await engine('DELETE',`/containers/${prior.rollback_container}`);} catch {}
    }
  } catch {
    let replacement;
    try {replacement=await engine('GET',`/containers/${name}/json`);} catch {}
    if(created || replacement?.Config.Labels?.['com.neiro.main-updater.original-container']===before.Id)
      await engine('DELETE',`/containers/${name}?force=true`);
    const original=await engine('GET',`/containers/${before.Id}/json`);
    if(original.Name!==('/'+name)) await engine('POST',`/containers/${before.Id}/rename?name=${name}`);
    await engine('POST',`/containers/${before.Id}/update`,{RestartPolicy:originalRestart});
    if(!original.State.Running) await engine('POST',`/containers/${before.Id}/start`);
    throw new Error('Update failed; original operator restored');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;})
  .finally(()=>{if(acquired) rmSync(mutex,{recursive:true,force:true});});
