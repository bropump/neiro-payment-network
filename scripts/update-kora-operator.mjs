// Host-native Docker rollout. Docker consumes the existing env-file opaquely;
// this helper never reads it or retrieves Config.Env from a running container.
import {resolveMain} from './resolve-kora-main.mjs';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';

const args=process.argv.slice(2),opts={container:'neiro-provider','state-dir':resolve('work/operator-updates')};
for(let i=0;i<args.length;i++){
  if(args[i]==='--enable-metadata'){opts.metadata=true;continue;}
  const name=args[i].replace(/^--/,'');
  if(!['container','state-dir','candidate-lock','health-url','env-file','config-dir'].includes(name)||!args[i+1])throw Error('Required: --env-file PATH --config-dir PATH; optional --container NAME --candidate-lock PATH --enable-metadata');
  opts[name]=args[++i];
}
if(!opts['env-file']||!opts['config-dir'])throw Error('Supply existing --env-file and --config-dir paths; credentials will not be inspected');
const name=opts.container,state=resolve(opts['state-dir']),configDir=resolve(opts['config-dir']),envFile=resolve(opts['env-file']);
if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)||configDir.includes(','))throw Error('Invalid container/config path');
if(!statSync(envFile).isFile())throw Error('Existing operator env-file required');
mkdirSync(state,{recursive:true,mode:0o700});
const mutex=resolve(state,name+'.lock');let acquired=false;
function docker(args){try{return execFileSync('docker',args,{encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe']}).trim();}catch{throw Error(`Docker ${args[0]} failed; private output suppressed`);}}
function field(container,expression){return JSON.parse(docker(['inspect','--format',`{{json .${expression}}}`,container]));}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function publicState(url){const r={};for(const method of ['getConfig','getPayerSigner']){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{}}),redirect:'error',signal:AbortSignal.timeout(5000)});
  const j=await response.json();if(!response.ok||!j.result)throw Error('Public readiness failed');r[method]=j.result;
}return r;}
async function healthy(url,expected){const deadline=Date.now()+60000;while(Date.now()<deadline){try{const value=await publicState(url);if(!isDeepStrictEqual(value,expected))throw Error('Settings mismatch');return value;}catch{}await pause(1000);}throw Error('New process did not preserve public payer/settings');}
function atomic(path,data){const temp=path+'.metadata-update.tmp';writeFileSync(temp,data,{mode:0o600});renameSync(temp,path);}
async function main(){
  try{mkdirSync(mutex,{mode:0o700});acquired=true;writeFileSync(resolve(mutex,'pid'),String(process.pid));}
  catch{let live=true;try{process.kill(Number(readFileSync(resolve(mutex,'pid'),'utf8')),0);}catch{live=false;}if(live)return console.log('Operator update already running');rmSync(mutex,{recursive:true,force:true});mkdirSync(mutex,{mode:0o700});acquired=true;writeFileSync(resolve(mutex,'pid'),String(process.pid));}
  if(!field(name,'State.Running'))throw Error('Operator stopped; no automatic start');
  const image=field(name,'Config.Image'),mounts=field(name,'Mounts'),ports=field(name,'HostConfig.PortBindings'),restart=field(name,'HostConfig.RestartPolicy');
  if(mounts.length!==1||mounts[0].Type!=='bind'||mounts[0].Source!==configDir||mounts[0].Destination!=='/config'||Object.keys(ports).length!==1||ports['8080/tcp']?.length!==1||field(name,'HostConfig.NetworkMode')!=='bridge'||field(name,'HostConfig.Privileged')||field(name,'HostConfig.NanoCpus')!==0||field(name,'HostConfig.Memory')!==0)throw Error('Unsupported Docker profile; original operator unchanged');
  const binding=ports['8080/tcp'][0];if(binding.HostIp!=='127.0.0.1')throw Error('Require existing loopback port binding');
  const url=opts['health-url']||`http://127.0.0.1:${binding.HostPort}`;
  const before=await publicState(url),expected=structuredClone(before);
  const pin=opts['candidate-lock']?JSON.parse(readFileSync(resolve(opts['candidate-lock']),'utf8')):await resolveMain();
  if(pin.channel!=='main'||!/^ghcr\.io\/solana-foundation\/kora@sha256:[a-f0-9]{64}$/.test(pin.image))throw Error('Invalid official image pin');
  // d5a7 adds this public field with the upstream default; no prior setting is overridden.
  if(!Object.hasOwn(expected.getConfig.validation_config,'allowed_transaction_versions'))
    expected.getConfig.validation_config.allowed_transaction_versions=['legacy',0,1];
  const needsMetadata=opts.metadata&&!before.getConfig.validation_config.token_2022.allow_token_metadata_instructions;
  if(image===pin.image&&!needsMetadata)return console.log(`Current: ${name} ${pin.upstream_commit}`);
  docker(['pull','--platform','linux/amd64',pin.image]);
  const revision=JSON.parse(docker(['image','inspect','--format','{{json .Config.Labels}}',pin.image]))['org.opencontainers.image.revision'];
  if(revision!==pin.upstream_commit)throw Error('Image revision differs from verified pin');
  const configPath=resolve(configDir,'kora.toml');let original;
  const backup=name+'-rollback-'+Date.now();let renamed=false,phase="prepare-config";
  try{
    if(needsMetadata){
      original=readFileSync(configPath,'utf8');
      const header=/^\[validation\.token_2022\][ \t]*(?:#.*)?$/m,match=header.exec(original);
      if(!match)throw Error('Expected existing Token-2022 config table');
      const end=original.indexOf('\n[',match.index+match[0].length),stop=end<0?original.length:end;
      const section=original.slice(match.index,stop),lines=section.match(/^allow_token_metadata_instructions\s*=/gm)||[];
      if(lines.length>1)throw Error('Duplicate metadata settings');
      const changed=lines.length?section.replace(/^allow_token_metadata_instructions\s*=.*$/m,'allow_token_metadata_instructions = true'):section.replace(header,match[0]+'\nallow_token_metadata_instructions = true');
      writeFileSync(resolve(state,backup+'.kora.toml'),original,{mode:0o600});
      atomic(configPath,original.slice(0,match.index)+changed+original.slice(stop));
      expected.getConfig.validation_config.token_2022.allow_token_metadata_instructions=true;
    }
    const mount=`type=bind,src=${configDir},dst=/config${mounts[0].RW?'':',readonly'}`;
    // Existing Kora's native config validator consumes its own signer reference.
    phase='validate-config';
    docker(['run','--rm','--platform','linux/amd64','--network','none','--env-file',envFile,'--mount',mount,'--entrypoint','kora',pin.image,'--config','/config/kora.toml','config','validate','--signers-config','/config/signers.toml']);
    phase='stop-original';
    docker(['update','--restart=no',name]);docker(['stop','--time','20',name]);docker(['rename',name,backup]);renamed=true;
    const restartArg=restart.Name==='on-failure'&&restart.MaximumRetryCount?`on-failure:${restart.MaximumRetryCount}`:restart.Name;
    phase='start-replacement';
    docker(['run','-d','--platform','linux/amd64','--name',name,'--restart',restartArg,'-p',`127.0.0.1:${binding.HostPort}:8080`,'--env-file',envFile,'--mount',mount,'--entrypoint','kora',pin.image,'--config','/config/kora.toml','rpc','start','--port','8080','--signers-config','/config/signers.toml']);
    phase='verify-public-state';
    const after=await healthy(url,expected);
    writeFileSync(resolve(state,name+'.json'),JSON.stringify({updated_at:new Date().toISOString(),image:pin.image,upstream_commit:pin.upstream_commit,rollback_container:backup,rollback_config:original?resolve(state,backup+'.kora.toml'):null,health_check:'passed'},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({status:'updated',name,commit:pin.upstream_commit,image:pin.image,payer:after.getConfig.fee_payers,price:after.getConfig.validation_config.price,metadata:after.getConfig.validation_config.token_2022.allow_token_metadata_instructions,rollback:backup}));
  }catch{
    if(original!==undefined)atomic(configPath,original);
    if(renamed){try{docker(['rm','-f',name]);}catch{}docker(['rename',backup,name]);}
    const restartArg=restart.Name==='on-failure'&&restart.MaximumRetryCount?`on-failure:${restart.MaximumRetryCount}`:restart.Name;
    docker(['update','--restart',restartArg,name]);if(!field(name,'State.Running'))docker(['start',name]);
    await healthy(url,before);throw Error(`Update failed during ${phase}; original operator and config restored`);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(acquired)rmSync(mutex,{recursive:true,force:true});});
