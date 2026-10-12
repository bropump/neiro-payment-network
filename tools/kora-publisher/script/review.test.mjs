// Independent mocked security review; ephemeral keys only, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {getTransactionDecoder} from '@solana/transactions';
import {getCompiledTransactionMessageDecoder} from '@solana/transaction-messages';
import {publish,lockState,reconcile,termsFromConfig} from './publisher.ts';
import {PROGRAM,MINT,SEED,recordAddress,keystring,keybytes,readRecord,verifyAttestation} from '../client/read-record.mjs';
const genesis='11111111111111111111111111111111';
function fixture(t){
 const pair=generateKeyPairSync('ed25519'),operator=keystring(pair.publicKey.export({format:'der',type:'spki'}).subarray(-32));
 const record=recordAddress(operator),stateDir=fs.mkdtempSync(path.join(os.tmpdir(),'neiro-review-'));t.after(()=>fs.rmSync(stateDir,{recursive:true,force:true}));
 const terms={v:5,operator,payment:operator,url:'https://example.com/',mint:MINT,genesis,oracle:'Jupiter',price:{type:'free'}};
 const f={operator,record,stateDir,terms,account:null,slot:100,clock:1000,anchorTime:1000,loads:0,signs:[],sends:[],statuses:[],fee:5000,rent:4373880,anchorTimes:new Map([[100,1000]])};
 f.loadSigner=async()=>{f.loads++;return {address:operator,signMessages:async messages=>messages.map(({content})=>{f.signs.push(Buffer.from(content));return {[operator]:new Uint8Array(sign(null,content,pair.privateKey))};})};};
 f.rpc=async(method,params)=>{
  if(method==='getGenesisHash')return genesis;
  if(method==='getAccountInfo'&&params[0]===record)return {context:{slot:f.slot},value:f.account};
  if(method==='getAccountInfo'){
   const d=Buffer.alloc(40);d.writeBigUInt64LE(BigInt(f.slot));d.writeBigInt64LE(BigInt(f.clock),32);
   return {context:{slot:f.slot},value:{owner:'Sysvar1111111111111111111111111111111111111',executable:false,data:[d.toString('base64'),'base64']}};
  }
  if(method==='getSlot')return f.slot;
  if(method==='getBlock')return {blockhash:genesis,blockTime:f.anchorTimes.get(params[0])??f.anchorTime,blockHeight:params[0]===f.slot?(f.height??100):100};
  if(method==='getMinimumBalanceForRentExemption')return f.rent;
  if(method==='getLatestBlockhash')return {context:{slot:f.slot},value:{blockhash:genesis,lastValidBlockHeight:12345}};
  if(method==='getFeeForMessage')return {value:f.fee};
  if(method==='getBlockHeight')return f.height??100;
  if(method==='isBlockhashValid')return {context:{slot:f.slot},value:f.validHash??false};
  if(method==='getTransaction')return f.historical??null;
  if(method==='getSignatureStatuses')return {context:{slot:f.statusContext??f.slot},value:[f.statuses.length?f.statuses.shift():{slot:f.slot,err:null,confirmationStatus:'finalized'}]};
  if(method==='sendTransaction'){
   const tx=getTransactionDecoder().decode(Buffer.from(params[0],'base64'));
   assert.deepEqual(Object.keys(tx.signatures),[operator]);assert(verifyAttestation(operator,tx.messageBytes,tx.signatures[operator]));
   const message=getCompiledTransactionMessageDecoder().decode(tx.messageBytes);assert.equal(message.version,'legacy');assert.equal(message.staticAccounts[0],operator);
   const instructions=message.instructions.map(ix=>({program:message.staticAccounts[ix.programAddressIndex],keys:ix.accountIndices.map(i=>message.staticAccounts[i]),data:Buffer.from(ix.data??[])}));f.sends.push(instructions);
   const receipt=JSON.parse(fs.readFileSync(path.join(stateDir,'pending.json')));assert.equal(receipt.record,record);
   if(f.sendError)throw new Error('simulated transport loss');
   const last=instructions.at(-1);
   if(last.data[0]===1){const bytes=Buffer.concat([Buffer.from([1]),keybytes(operator),last.data.subarray(13)]);f.account={owner:PROGRAM,executable:false,lamports:f.rent,data:[bytes.toString('base64'),'base64']};}
   else if(last.data[0]===3)f.account=null;
   return receipt.signature;
  }
  throw new Error('unexpected RPC '+method);
 };
 f.run=(options={})=>publish({...f,rpc:f.rpc,genesis,loadSigner:f.loadSigner,wait:async()=>{},...options});return f;
}
test('wire create/init/write has correct seeded account, authority and exact signed payload',async t=>{
 const f=fixture(t);assert.equal((await f.run()).status,'finalized');assert.equal(f.loads,1);assert.equal(f.signs.length,2);
 const instructions=f.sends[0];assert.equal(instructions.length,3);const [create,init,write]=instructions;
 assert.equal(create.program,genesis);assert.equal(create.data.readUInt32LE(),3);assert.equal(keystring(create.data.subarray(4,36)),f.operator);assert.equal(Number(create.data.readBigUInt64LE(36)),SEED.length);assert.equal(create.data.subarray(44,44+SEED.length).toString(),SEED);
 const offset=44+SEED.length;assert.equal(create.data.readBigUInt64LE(offset),BigInt(f.rent));assert.equal(create.data.readBigUInt64LE(offset+8),733n);assert.equal(keystring(create.data.subarray(offset+16)),PROGRAM);assert.deepEqual(create.keys.slice(0,2),[f.operator,f.record]);
 assert.equal(init.program,PROGRAM);assert.deepEqual([...init.data],[0]);assert.equal(write.program,PROGRAM);assert.equal(write.data[0],1);assert.equal(write.data.readBigUInt64LE(1),0n);assert.equal(write.data.readUInt32LE(9),700);assert.equal(write.data.length,713);assert.deepEqual(write.keys,[f.record,f.operator]);
 assert.equal(readRecord(f.record,f.account,genesis,{nowUnixSeconds:f.clock,anchorSlot:100,anchorBlockhash:genesis,anchorBlockTime:1000}).v,5);
 assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));assert.equal(JSON.parse(fs.readFileSync(path.join(f.stateDir,'finalized.json'))).slot,100);
 const signs=f.signs.length;assert.equal((await f.run()).status,'unchanged');assert.equal(f.signs.length,signs);assert.equal(f.sends.length,1);
});
test('prefunding recovery atomically transfers only back to operator before creation',async t=>{
 const f=fixture(t);f.account={owner:genesis,executable:false,lamports:123,data:['','base64']};await f.run();
 const instructions=f.sends[0];assert.equal(instructions.length,4);const x=instructions[0];assert.equal(x.program,genesis);assert.equal(x.data.readUInt32LE(),11);assert.equal(x.data.readBigUInt64LE(4),123n);assert.deepEqual(x.keys,[f.record,f.operator,f.operator]);assert.equal(Number(x.data.readBigUInt64LE(12)),SEED.length);assert.equal(x.data.subarray(20,20+SEED.length).toString(),SEED);assert.equal(keystring(x.data.subarray(20+SEED.length)),PROGRAM);
});
test('close returns rent only to operator with one record instruction',async t=>{
 const f=fixture(t);await f.run();const before=f.signs.length;await f.run({action:'close',terms:undefined});assert.equal(f.signs.length,before+1);const instructions=f.sends.at(-1);assert.equal(instructions.length,1);const ix=instructions[0];assert.equal(ix.program,PROGRAM);assert.deepEqual([...ix.data],[3]);assert.deepEqual(ix.keys,[f.record,f.operator,f.operator]);
});
test('ambiguous send keeps pending receipt and blocks signer access on restart',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run(),/transport loss/);const pending=fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8');f.sendError=false;f.statuses=[null];const loads=f.loads;await assert.rejects(f.run(),/PENDING_STILL_VALID/);assert.equal(f.loads,loads);assert.equal(f.sends.length,2);assert.equal(fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8'),pending);
});
test('finalized watermark rejects stale record reads before signer access',async t=>{
 const f=fixture(t);await f.run();f.slot=99;const loads=f.loads;await assert.rejects(f.run(),/stale account/);assert.equal(f.loads,loads);
});
test('caps, stale anchor and signer mismatch cannot broadcast',async t=>{
 for(const scenario of ['fee','rent','clock','identity']){const f=fixture(t);if(scenario==='fee')f.fee=10001;if(scenario==='rent')f.rent=7000001;if(scenario==='clock')f.clock=1061;if(scenario==='identity')f.loadSigner=async()=>({address:genesis,signMessages(){throw Error('must not sign');}});await assert.rejects(f.run());assert.equal(f.sends.length,0);assert.equal(f.signs.length,0);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));}
});
test('directory lock excludes overlap and never evicts old orphan automatically',t=>{
 const f=fixture(t),release=lockState(f.stateDir);assert.throws(()=>lockState(f.stateDir));fs.utimesSync(path.join(f.stateDir,'runner.lock'),new Date(0),new Date(0));assert.throws(()=>lockState(f.stateDir));release();lockState(f.stateDir)();
});
test('foreign receipt identity fails closed',async t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.stateDir,'pending.json'),JSON.stringify({record:genesis,genesis,signature:'1'.repeat(64)}));await assert.rejects(reconcile(f.rpc,f.stateDir,f.record,genesis),/identity/);assert.equal(f.loads,0);
});
test('daily boundary uses chain time and changed terms update immediately',async t=>{
 const f=fixture(t);await f.run();f.slot=101;f.clock=f.anchorTime=1000+86399;assert.equal((await f.run()).status,'unchanged');assert.equal(f.sends.length,1);
 f.clock=f.anchorTime=1000+86400;assert.equal((await f.run()).status,'finalized');assert.equal(f.sends.length,2);f.anchorTimes.set(101,f.anchorTime);
 assert.equal((await f.run()).status,'unchanged');f.terms={...f.terms,url:'https://changed.example/'};assert.equal((await f.run()).status,'finalized');assert.equal(f.sends.length,3);
});
test('restart after send finalized but reconciliation timeout does not duplicate signing',async t=>{
 const f=fixture(t);f.statuses=[{slot:100,err:null,confirmationStatus:'finalized'},null];await assert.rejects(f.run(),/PENDING_STILL_VALID/);assert(fs.existsSync(path.join(f.stateDir,'pending.json')));const signs=f.signs.length;
 assert.equal((await f.run()).status,'unchanged');assert.equal(f.signs.length,signs);assert.equal(f.sends.length,2);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
});
test('configuration guard rejects malformed strings in place of required account arrays',t=>{
 const f=fixture(t),validation={price:{type:'free'},price_source:'Jupiter',allowed_tokens:[MINT],allowed_spl_paid_tokens:[MINT],disallowed_accounts:[f.record]};
 const toml=`[kora]\n[validation]\nprice={type="free"}\nprice_source="Jupiter"\nallowed_tokens=["${MINT}"]\nallowed_spl_paid_tokens=["${MINT}"]\ndisallowed_accounts=["${f.record}"]\n`;
 const live={fee_payers:[f.operator],validation_config:validation},payer={signer_address:f.operator,payment_address:f.operator};
 assert.equal(termsFromConfig(toml,f.operator,f.terms.url,genesis,live,payer).operator,f.operator);
 for(const field of ['allowed_tokens','allowed_spl_paid_tokens','disallowed_accounts']){
  const bad=structuredClone(live);bad.validation_config[field]=bad.validation_config[field][0];assert.throws(()=>termsFromConfig(toml,f.operator,f.terms.url,genesis,bad,payer));
  const value=validation[field][0],badToml=toml.replace(`${field}=["${value}"]`,`${field}="${value}"`);assert.throws(()=>termsFromConfig(badToml,f.operator,f.terms.url,genesis,live,payer));
 }
 assert.throws(()=>termsFromConfig(toml,f.operator,f.terms.url,genesis,{...live,fee_payers:f.operator},payer));
});
test('discovery refreshes chain Clock after candidate anchor lookup',async t=>{
 const {main}=await import('./runner.ts');const f=fixture(t);await f.run();const calls=[];
 const previousFetch=globalThis.fetch,previousLog=console.log;globalThis.fetch=async (_url,options)=>{
  const req=JSON.parse(options.body);calls.push(req);
  let result;if(req.method==='getProgramAccounts')result=[{pubkey:f.record,account:f.account}];else result=await f.rpc(req.method,req.params);
  return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}),{status:200,headers:{'content-type':'application/json'}});
 };console.log=()=>{};
 try{await main(['discover','--genesis',genesis],{SOLANA_RPC_URL:'http://127.0.0.1:19999'});}finally{globalThis.fetch=previousFetch;console.log=previousLog;}
 const anchorIndex=calls.findIndex(x=>x.method==='getBlock');const clockIndex=calls.findIndex(x=>x.method==='getAccountInfo');assert(anchorIndex>=0&&clockIndex>anchorIndex,'Clock must be fetched after anchor');assert.equal(calls[clockIndex].params[1].minContextSlot,100);
});

test('expired unobserved attempt is archived and renewal succeeds with a fresh signature',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());
 const receipt=JSON.parse(fs.readFileSync(path.join(f.stateDir,'pending.json')));
 f.sendError=false;f.height=12346;f.statuses=[null,null];
 assert.equal((await f.run()).status,'finalized');
 assert.equal(f.loads,2);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.stateDir,receipt.signature+'.outcome.json'))).outcome,'expired-unobserved');
});
test('valid pending attempt retries identical bytes without loading signer; check never submits',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());f.sendError=false;
 const pending=fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8'),loads=f.loads;
 f.statuses=[null];await assert.rejects(f.run({action:'check'}),/PENDING_STILL_VALID/);assert.equal(f.sends.length,1);
 f.statuses=[null];await assert.rejects(f.run(),/PENDING_STILL_VALID/);assert.equal(f.loads,loads);assert.deepEqual(f.sends[0],f.sends[1]);
 assert.equal(fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8'),pending);
});
test('null status cannot clear a still-valid lifetime, stale context, inconsistent expiry or RPC outage',async t=>{
 for(const scenario of ['stale','valid','conflict','outage','confirmed']){
  const f=fixture(t);f.sendError=true;await assert.rejects(f.run());f.sendError=false;f.height=12346;
  const pending=fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8');f.statuses=[null,null];
  if(scenario==='stale')f.statusContext=99;
  if(scenario==='valid')f.height=12345;
  if(scenario==='conflict')f.validHash=true;
  if(scenario==='confirmed')f.statuses=[null,{slot:100,err:null,confirmationStatus:'confirmed'}];
  if(scenario==='outage'){const rpc=f.rpc;f.rpc=(method,params)=>method==='getBlock'?Promise.reject(Error('outage')):rpc(method,params);}
  await assert.rejects(f.run());assert.equal(f.loads,1);assert.equal(fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8'),pending);
 }
});
test('finalization racing expiry is reconciled rather than replaced',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());f.height=12346;
 f.statuses=[null,{slot:100,err:null,confirmationStatus:'finalized'}];
 assert.equal(await reconcile(f.rpc,f.stateDir,f.record,genesis,{operator:f.operator}),100);assert.equal(f.loads,1);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
});
test('history result is honored when signature status index returns null',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());f.height=12346;f.statuses=[null,null];f.historical={slot:100,meta:{err:null}};
 assert.equal(await reconcile(f.rpc,f.stateDir,f.record,genesis,{operator:f.operator}),100);assert.equal(f.loads,1);
});
test('finalized failure archives receipt, raises actionable error and does not sign another transaction in that attempt',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());
 const receipt=JSON.parse(fs.readFileSync(path.join(f.stateDir,'pending.json')));
 f.statuses=[{slot:100,err:{InstructionError:[0,'Custom']},confirmationStatus:'finalized'}];
 await assert.rejects(f.run(),/TRANSACTION_FINALIZED_FAILED/);assert.equal(f.loads,1);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.stateDir,receipt.signature+'.outcome.json'))).outcome,'failed');
});
test('tampered wire signature or blockhash fails before resend or signer access',async t=>{
 for(const field of ['transaction','signature','blockhash']){
  const f=fixture(t);f.sendError=true;await assert.rejects(f.run());const file=path.join(f.stateDir,'pending.json'),r=JSON.parse(fs.readFileSync(file));
  r[field]=field==='transaction'?Buffer.from('invalid').toString('base64'):f.operator;fs.writeFileSync(file,JSON.stringify(r));
  await assert.rejects(f.run());assert.equal(f.loads,1);assert.equal(f.sends.length,1);
 }
});
test('legacy receipt needs exact signature and trusted cutoff plus finalized block-height expiry',async t=>{
 const f=fixture(t),signature='1'.repeat(64),receipt={record:f.record,genesis,signature};
 const file=path.join(f.stateDir,'pending.json');fs.writeFileSync(file,JSON.stringify(receipt));
 f.statuses=[null];await assert.rejects(f.run(),/LEGACY_RECOVERY_REQUIRED/);
 f.statuses=[null];await assert.rejects(f.run({legacyRecovery:{signature:'2'.repeat(64),beforeSlot:100}}),/LEGACY_RECOVERY_REQUIRED/);
 f.slot=101;f.statuses=[null];f.height=260;await assert.rejects(f.run({legacyRecovery:{signature,beforeSlot:100}}),/LEGACY_EXPIRY_WAIT/);
 assert(fs.existsSync(file));assert.equal(f.loads,0);
 f.statuses=[null,null];f.height=261;
 await reconcile(f.rpc,f.stateDir,f.record,genesis,{operator:f.operator,legacyRecovery:{signature,beforeSlot:100}});
 assert(!fs.existsSync(file));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.stateDir,signature+'.json'))),receipt);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.stateDir,signature+'.legacy-proof.json'))).beforeSlot,100);
});
test('crash after archiving but before pending removal reconciles idempotently',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());const r=JSON.parse(fs.readFileSync(path.join(f.stateDir,'pending.json')));
 fs.writeFileSync(path.join(f.stateDir,r.signature+'.json'),JSON.stringify(r));
 assert.equal(await reconcile(f.rpc,f.stateDir,f.record,genesis,{operator:f.operator}),100);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
});
test('safe diagnostics never expose RPC URL or raw response/signer messages',async()=>{
 const {rpcClient,safeErrorCode}=await import('./publisher.ts');
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('https://secret.example/API-KEY');};
 try{await assert.rejects(rpcClient('https://secret.example/API-KEY')('getBlockHeight'),e=>safeErrorCode(e)==='RPC_getBlockHeight_TRANSPORT_OR_RESPONSE');}finally{globalThis.fetch=original;}
 assert.equal(safeErrorCode(Error('private key goes here')),'VALIDATION_OR_SIGNER_FAILED');
});

test('finalized string transaction error is terminal and archived without another signature',async t=>{
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run());
 f.statuses=[{slot:100,err:'AccountNotFound',confirmationStatus:'finalized'}];
 await assert.rejects(f.run(),/TRANSACTION_FINALIZED_FAILED/);assert.equal(f.loads,1);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
});
