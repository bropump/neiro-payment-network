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
  if(method==='getBlock')return {blockhash:genesis,blockTime:f.anchorTimes.get(params[0])??f.anchorTime};
  if(method==='getMinimumBalanceForRentExemption')return f.rent;
  if(method==='getLatestBlockhash')return {value:{blockhash:genesis,lastValidBlockHeight:12345}};
  if(method==='getFeeForMessage')return {value:f.fee};
  if(method==='getSignatureStatuses')return {value:[f.statuses.length?f.statuses.shift():{slot:f.slot,err:null,confirmationStatus:'finalized'}]};
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
 const f=fixture(t);f.sendError=true;await assert.rejects(f.run(),/transport loss/);const pending=fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8');f.sendError=false;f.statuses=[null];const loads=f.loads;await assert.rejects(f.run(),/unresolved/);assert.equal(f.loads,loads);assert.equal(f.sends.length,1);assert.equal(fs.readFileSync(path.join(f.stateDir,'pending.json'),'utf8'),pending);
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
 const f=fixture(t);f.statuses=[{slot:100,err:null,confirmationStatus:'finalized'},null];await assert.rejects(f.run(),/unresolved/);assert(fs.existsSync(path.join(f.stateDir,'pending.json')));const signs=f.signs.length;
 assert.equal((await f.run()).status,'unchanged');assert.equal(f.signs.length,signs);assert.equal(f.sends.length,1);assert(!fs.existsSync(path.join(f.stateDir,'pending.json')));
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
