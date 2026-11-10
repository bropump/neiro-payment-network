// Isolated real-image check; deterministic fixture signer, no signing/submission calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createPrivateKey,createPublicKey} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(readFileSync(join(root,'examples/operator/kora-release.json')));
const directory=mkdtempSync(join(tmpdir(),'npn-rate-limit-'));
const name='npn-rate-limit-'+process.pid;
const seed=Buffer.alloc(32,79),key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});
const pub=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32);
const config=readFileSync(join(root,'examples/operator/kora.toml'),'utf8');
const signers=readFileSync(join(root,'examples/operator/signers.toml'),'utf8');
const entry=readFileSync(join(root,'scripts/bunny-rate-limit-entrypoint.sh'),'utf8');
const env={PATH:process.env.PATH,DOCKER_HOST:process.env.DOCKER_HOST,RPC_URL:'https://api.mainnet-beta.solana.com',JUPITER_API_KEY:'CONFIG_VALIDATION_ONLY',KORA_PRIVATE_KEY:JSON.stringify([...seed,...pub]),KORA_CONFIG_BASE64:Buffer.from(config).toString('base64'),KORA_SIGNERS_BASE64:Buffer.from(signers).toString('base64')};
function docker(args){return execFileSync('docker',args,{env,encoding:'utf8',timeout:180000});}
try{
  // Run the actual startup transform against a public fixture using a harmless stub.
  writeFileSync(join(directory,'kora'),'#!/bin/sh\nexit 0\n',{mode:0o755});
  const fixture=config.replace('rate_limit = 10','rate_limit = 100').replace('global_rate_limit = 10','global_rate_limit = 77');
  execFileSync('/bin/sh',['-c',entry.replaceAll('/tmp/kora',directory)],{env:{...env,PATH:directory+':'+env.PATH,KORA_CONFIG_BASE64:Buffer.from(fixture).toString('base64')},stdio:'pipe'});
  const parsed=JSON.parse(execFileSync('python3',['-c','import json,tomllib,sys; print(json.dumps(tomllib.load(open(sys.argv[1],"rb"))))',join(directory,'kora.toml')],{encoding:'utf8'}));
  const original=JSON.parse(execFileSync('python3',['-c','import json,tomllib,sys; print(json.dumps(tomllib.loads(sys.stdin.read())))'],{input:config,encoding:'utf8'}));
  assert.deepEqual(parsed,original,'Startup transform changed settings beyond the two approved request limits');
  assert.equal(readFileSync(join(directory,'signers.toml'),'utf8'),signers);
  const bad=fixture+'\n[kora]\nrate_limit = 55\n';
  assert.throws(()=>execFileSync('/bin/sh',['-c',entry.replaceAll('/tmp/kora',directory)],{env:{...env,PATH:directory+':'+env.PATH,KORA_CONFIG_BASE64:Buffer.from(bad).toString('base64')},stdio:'pipe'}));
  docker(['run','-d','--name',name,'--platform','linux/amd64','-p','127.0.0.1::8080',...['RPC_URL','JUPITER_API_KEY','KORA_PRIVATE_KEY','KORA_CONFIG_BASE64','KORA_SIGNERS_BASE64'].flatMap(k=>['-e',k]),'--entrypoint','/bin/sh',lock.image,'-c',entry]);
  const port=docker(['port',name,'8080/tcp']).trim().split(':').at(-1),url='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<40;i++){
    try{const r=await fetch(url+'/liveness');if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  assert(ready,'Fixture Kora failed to become ready');
  const call=()=>fetch(url,{method:'POST',headers:{'content-type':'application/json',Origin:'https://neiropay.com'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getConfig',params:{}})});
  const start=performance.now(),responses=await Promise.all(Array.from({length:25},call));
  const elapsedMs=performance.now()-start;
  const counts={};for(const r of responses){counts[r.status]=(counts[r.status]??0)+1;await r.arrayBuffer();assert.equal(r.headers.get('access-control-allow-origin'),'*');}
  assert(counts[200]>0&&counts[429]>0,'Real limiter must admit and reject requests');
  assert(counts[200]<=10+Math.ceil(elapsedMs/100),'Admissions exceed burst capacity plus refill');
  assert.equal((await fetch(url+'/liveness')).status,200,'Health must remain available under limiting');
  await new Promise(r=>setTimeout(r,1200));
  assert.equal((await call()).status,200,'Limiter must recover after refill');
  console.log(JSON.stringify({pass:true,commit:lock.upstream_commit,counts,elapsedMs,globalRps:10,burst:10,healthBypass:true,refill:true,startupPreservesOtherSettings:true,duplicateSectionRejected:true}));
}finally{try{docker(['rm','-f',name]);}catch{}rmSync(directory,{recursive:true,force:true});}
