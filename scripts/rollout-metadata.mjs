// Read only public operator state and secret-free Bunny endpoint/overview APIs.
// Never request the application/container configuration or environment API.
const app=process.env.BUNNY_KORA_APP_ID;
const key=process.env.BUNNY_KORA_API_KEY;
const name=process.env.BUNNY_KORA_CONTAINER_NAME || 'stock-kora';
if(!app || !key) throw new Error('Missing platform deployment credential/reference');
async function overview(path) {
  if(!['/overview','/endpoints'].includes(path))throw new Error('Forbidden platform read');
  const r=await fetch(`https://api.bunny.net/mc/apps/${encodeURIComponent(app)}${path}`,{headers:{AccessKey:key},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`Platform overview HTTP ${r.status}`);return r.json();
}
async function main(){
  const endpoints=await overview('/endpoints');
  const selected=endpoints.items.filter(e=>e.containerName===name&&e.type==='cdn');
  if(selected.length!==1)throw new Error('Expected one named public Kora endpoint');
  const ep=selected[0], state=await overview('/overview');
  const images=[...new Set(state.regions.flatMap(r=>r.pods??[]).flatMap(p=>p.containers??[]).filter(c=>c.name===name).map(c=>c.image))];
  const output={containerId:ep.containerId,images,status:state.status,regions:state.regions.map(r=>({region:r.region,status:r.status,instances:r.instances})),public:{}};
  for(const method of ['getVersion','getConfig','getPayerSigner']){
    const response=await fetch(`https://${ep.publicHost.split(':')[0]}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{}}),redirect:'error',signal:AbortSignal.timeout(15000)});
    const j=await response.json();if(!j.result)throw new Error('Public Kora read failed');output.public[method]=j.result;
  }
  console.log(JSON.stringify(output));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
