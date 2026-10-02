// Host adapter only: replace a Bunny operator image without touching Kora or keys.
import {readFileSync} from 'node:fs';
const app=process.env.BUNNY_KORA_APP_ID;
const key=process.env.BUNNY_KORA_API_KEY;
const name=process.env.BUNNY_KORA_CONTAINER_NAME || 'stock-kora';
if(!app || !key) throw new Error('Load the Bunny operator deployment credential and application ID');
const lock=JSON.parse(readFileSync(new URL('../examples/operator/kora-release.json',import.meta.url),'utf8'));
if(lock.channel!=='main' || !/^[a-f0-9]{40}$/.test(lock.upstream_commit) ||
   !/^ghcr\.io\/solana-foundation\/kora@sha256:[a-f0-9]{64}$/.test(lock.image)) throw new Error('Invalid official main pin');
async function api(path,method='GET',body) {
  const response=await fetch(`https://api.bunny.net/mc/apps/${encodeURIComponent(app)}${path}`,{
    method,redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{'AccessKey':key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok) throw new Error(`Bunny deployment API HTTP ${response.status}`);
  const text=await response.text();return text?JSON.parse(text):{};
}
async function main() {
  const configuration=await api('');
  const containers=configuration.containerTemplates.filter(c=>c.name===name);
  if(containers.length!==1) throw new Error('Expected exactly one named Bunny operator container');
  const before=containers[0];
  if(before.imageName!=='kora' || before.imageNamespace!=='solana-foundation')
    throw new Error('Refusing to change a container that is not official Kora');
  const digest=lock.image.split('@')[1];
  if(before.imageTag===lock.image_tag && before.imageDigest===digest) {console.log('Bunny operator main pin is current');return;}
  const path=`/containers/${encodeURIComponent(before.id)}`;
  await api(path,'PATCH',{id:before.id,imageTag:lock.image_tag,imageDigest:digest});
  const after=(await api('')).containerTemplates.find(c=>c.id===before.id);
  if(after?.imageTag!==lock.image_tag || after?.imageDigest!==digest ||
    JSON.stringify(after.environmentVariables)!==JSON.stringify(before.environmentVariables) ||
    JSON.stringify(after.entryPoint)!==JSON.stringify(before.entryPoint)) {
    await api(path,'PATCH',{id:before.id,imageTag:before.imageTag,imageDigest:before.imageDigest});
    throw new Error('Bunny image/settings verification failed; previous image requested');
  }
  const endpoint=before.endpoints.find(e=>e.type==='cdn' && e.publicHost);
  const previousIds=new Set((configuration.containerInstances ?? []).map(c=>c.id));
  const deadline=Date.now()+180000;
  try {
    if(!endpoint) throw new Error('Bunny operator has no HTTPS endpoint for its health check');
    while(Date.now()<deadline) {
      const current=await api('');
      const replaced=(current.containerInstances ?? []).some(c=>c.templateId===before.id && !previousIds.has(c.id));
      if(replaced) {
        try {
          const response=await fetch(`https://${endpoint.publicHost.split(':')[0]}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
            headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getVersion',params:{}})});
          const body=await response.json();
          if(response.ok && typeof body.result?.version==='string') {
            console.log(`Bunny operator replaced and healthy: ${lock.upstream_commit}`);return;
          }
        } catch {}
      }
      await new Promise(resolve=>setTimeout(resolve,3000));
    }
    throw new Error('Bunny rollout health check timed out');
  } catch {
    await api(path,'PATCH',{id:before.id,imageTag:before.imageTag,imageDigest:before.imageDigest});
    throw new Error('Bunny rollout failed; previous image restoration requested');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
