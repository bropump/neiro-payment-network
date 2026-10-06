// Only secret-free overview/endpoints reads; never fetch application/config/env.
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export async function updateBunny({app,key,name='stock-kora',lock,enableMetadata=false,fetchFn=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeout=300000}) {
  if(!app || !key)throw Error('Missing Bunny deployment credential/reference');
  if(lock.channel!=='main'||!/^ghcr\.io\/solana-foundation\/kora@sha256:[a-f0-9]{64}$/.test(lock.image)||!/^sha256:[a-f0-9]{64}$/.test(lock.runtime_image_digest)||!/^[a-f0-9]{40}$/.test(lock.upstream_commit))throw Error('Invalid verified main image pin');
  const apiBase=`https://api.bunny.net/mc/apps/${encodeURIComponent(app)}`;
  async function read(path){
    if(!['/overview','/endpoints'].includes(path))throw Error('Forbidden platform configuration read');
    const r=await fetchFn(apiBase+path,{headers:{AccessKey:key},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error(`Bunny overview HTTP ${r.status}`);return r.json();
  }
  async function patch(id,body){
    const r=await fetchFn(apiBase+`/containers/${encodeURIComponent(id)}`,{method:'PATCH',headers:{AccessKey:key,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
    // PATCH may return a full template including environment. Do not consume it.
    await r.body?.cancel();
    if(!r.ok)throw Error(`Bunny update HTTP ${r.status}`);
  }
  const endpoints=(await read('/endpoints')).items.filter(e=>e.containerName===name&&e.type==='cdn');
  if(endpoints.length!==1)throw Error('Expected one named public Kora endpoint');
  const ep=endpoints[0],url=`https://${ep.publicHost.split(':')[0]}`;
  async function publicState(){
    const out={};
    for(const method of ['getConfig','getPayerSigner']){
      const r=await fetchFn(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{}}),redirect:'error',signal:AbortSignal.timeout(15000)});
      const j=await r.json();if(!r.ok||!j.result)throw Error('Public Kora readiness failed');out[method]=j.result;
    }
    return out;
  }
  const containers=s=>s.regions.flatMap(r=>r.pods??[]).flatMap(p=>p.containers??[]).filter(c=>c.name===name);
  const initial=await read('/overview'),running=containers(initial);
  const previous=[...new Set(running.map(c=>c.image?.match(/@sha256:[a-f0-9]{64}$/)?.[0].slice(1)))];
  if(!running.length||previous.length!==1||!previous[0])throw Error('Cannot determine one previous image for rollback');
  const before=await publicState(),expected=structuredClone(before);
  // d5a7 adds this public field with the upstream default; no prior setting is overridden.
  if(!Object.hasOwn(expected.getConfig.validation_config,'allowed_transaction_versions'))
    expected.getConfig.validation_config.allowed_transaction_versions=['legacy',0,1];
  const needsMetadata=enableMetadata&&!before.getConfig.validation_config.token_2022.allow_token_metadata_instructions;
  const next={imageTag:lock.image_tag,imageDigest:lock.image.split('@')[1]};
  const rollback={imageDigest:previous[0]};
  if(needsMetadata){
    if(before.getConfig.enabled_methods.sign_transaction!==true)throw Error('Operator does not match the recorded startup lineage');
    next.entryPoint={commandArray:['/bin/sh','-c'],argumentsArray:[readFileSync(new URL('./bunny-metadata-entrypoint.sh',import.meta.url),'utf8')]};
    rollback.entryPoint=JSON.parse(readFileSync(new URL('./bunny-previous-entrypoint.json',import.meta.url),'utf8'));
    expected.getConfig.validation_config.token_2022.allow_token_metadata_instructions=true;
  }
  if(previous[0]===lock.runtime_image_digest&&!needsMetadata)return {status:'current',commit:lock.upstream_commit,payer:before.getConfig.fee_payers};
  async function waitFor(digest,expectedState){
    const deadline=now()+timeout;
    while(now()<deadline){
      await pause(5000);const overview=await read('/overview'),active=containers(overview);
      if(active.length<running.length||!active.every(c=>c.image?.endsWith('@'+digest)))continue;
      let after;try{after=await publicState();}catch{continue;}
      if(!isDeepStrictEqual(after,expectedState))throw Error('Public payer/settings changed beyond the approved metadata flag');
      return {overview,after};
    }
    throw Error('Rollout readiness timed out');
  }
  try{
    await patch(ep.containerId,next);
    const {overview,after}=await waitFor(lock.runtime_image_digest,expected);
    return {status:'updated',commit:lock.upstream_commit,image:lock.image,previousRuntimeDigest:previous[0],payer:after.getConfig.fee_payers,price:after.getConfig.validation_config.price,metadata:after.getConfig.validation_config.token_2022.allow_token_metadata_instructions,regions:overview.regions.map(r=>({region:r.region,status:r.status,instances:r.instances}))};
  }catch{
    await patch(ep.containerId,rollback);
    try{await waitFor(previous[0],before);}catch{throw Error('Rollout failed; rollback requested but health not confirmed');}
    throw Error('Rollout failed; previous image and public settings verified restored');
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.some(a=>a!=='--enable-metadata'))throw Error('Usage: update-bunny-kora.mjs [--enable-metadata]');
  const lock=JSON.parse(readFileSync(new URL('../examples/operator/kora-release.json',import.meta.url),'utf8'));
  updateBunny({app:process.env.BUNNY_KORA_APP_ID,key:process.env.BUNNY_KORA_API_KEY,name:process.env.BUNNY_KORA_CONTAINER_NAME||'stock-kora',lock,enableMetadata:args.includes('--enable-metadata')})
    .then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
