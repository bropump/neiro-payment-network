// Private operator administration. Never call this through a public Kora signing endpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createTransactionMessage,setTransactionMessageFeePayer,setTransactionMessageLifetimeUsingBlockhash,appendTransactionMessageInstructions} from '@solana/transaction-messages';
import {compileTransaction,getTransactionEncoder} from '@solana/transactions';
import {getBase58Decoder} from '@solana/codecs-strings';
import {getCreateAccountWithSeedInstruction,getTransferSolWithSeedInstruction,SYSTEM_PROGRAM_ADDRESS} from '@solana-program/system';
import {parse} from 'smol-toml';
import {createNoopSigner} from '@solana/signers';
import {PROGRAM, MINT, MAGIC, SEED, recordAddress, keybytes, keystring,
  attestationMessage, verifyAttestation, readRecord} from '../client/read-record.mjs';
import {validatePrice} from '../client/verify-quote.mjs';
export const GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const SPACE=733, RENEW_AFTER=86400;
const finalized={commitment:'finalized'}, system=SYSTEM_PROGRAM_ADDRESS;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const includes=(xs,value)=>Array.isArray(xs)&&xs.includes(value);
export function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  assert(typeof value!=='bigint' && (typeof value!=='number'||Number.isFinite(value)),'unsupported JSON value');
  return value;
}
export function rpcClient(url) {
  const u=new URL(url);
  assert(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname)),'RPC requires HTTPS or loopback');
  let id=0;
  return async (method,params=[])=>{
    const requestId=++id;
    const r=await fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(20000)});
    assert(r.ok,'RPC HTTP failure');
    const chunks=[];let size=0;
    for await(const chunk of r.body){size+=chunk.length;assert(size<=8*1024*1024,'RPC response too large');chunks.push(chunk);}
    const x=JSON.parse(Buffer.concat(chunks).toString());
    assert(x.jsonrpc==='2.0'&&x.id===requestId&&!x.error,'RPC rejected request');
    return x.result;
  };
}
export async function anchorAt(rpc,slot) {
  assert(integer(slot),'invalid anchor slot');
  const b=await rpc('getBlock',[slot,{...finalized,transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0}]);
  assert(b && integer(b.blockTime),'missing block time');keybytes(b.blockhash);
  return {slot,hash:b.blockhash,time:b.blockTime};
}
export async function chainTime(rpc,minSlot) {
  const r=await rpc('getAccountInfo',['SysvarC1ock11111111111111111111111111111111',{...finalized,encoding:'base64',minContextSlot:minSlot}]);
  assert(integer(r?.context?.slot)&&r.context.slot>=minSlot,'stale Clock context');
  const a=r.value;
  assert(a?.owner==='Sysvar1111111111111111111111111111111111111'&&a.executable===false&&a.data?.[1]==='base64','invalid Clock');
  const b=Buffer.from(a.data[0],'base64');assert.equal(b.length,40,'Clock length');
  const slot=b.readBigUInt64LE(),time=b.readBigInt64LE(32);
  assert(slot>=BigInt(minSlot)&&slot<=BigInt(r.context.slot),'inconsistent Clock slot');
  assert(time>=0n&&time<=BigInt(Number.MAX_SAFE_INTEGER),'invalid Clock timestamp');return Number(time);
}
export function termsFromConfig(text,operator,url,genesis,live,payer) {
  const cfg=parse(text),v=cfg.validation;assert(v,'missing validation config');
  keybytes(operator);keybytes(genesis);
  const u=new URL(url);assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash,'public HTTPS URL required');
  const record=recordAddress(operator),payment=cfg.kora?.payment_address||operator;
  keybytes(payment);validatePrice(v.price);
  assert(includes(v.allowed_tokens,MINT),'NEIRO not allowed');
  assert(v.allowed_spl_paid_tokens==='All'||includes(v.allowed_spl_paid_tokens,MINT),'NEIRO fees not allowed');
  assert(includes(v.disallowed_accounts,record),'private config must deny listing');
  assert(includes(live?.fee_payers,operator),'operator not served');
  const actual=live.validation_config;
  assert(includes(actual?.disallowed_accounts,record),'live Kora must deny listing');
  assert(includes(actual.allowed_tokens,MINT),'live NEIRO not allowed');
  assert(actual.allowed_spl_paid_tokens==='All'||includes(actual.allowed_spl_paid_tokens,MINT),'live NEIRO fees not allowed');
  assert.deepEqual(canonical(actual.price),canonical(v.price),'live price mismatch');
  assert.equal(actual.price_source,v.price_source,'live oracle mismatch');
  assert(['Jupiter','Mock','CoinGecko'].includes(v.price_source),'unknown price source');
  assert.equal(payer?.signer_address,operator,'live signer mismatch');
  assert.equal(payer?.payment_address,payment,'live payment mismatch');
  return {v:5,operator,payment,url:u.href,mint:MINT,genesis,oracle:v.price_source,price:v.price};
}
function accountBytes(a,operator) {
  assert(a?.owner===PROGRAM&&a.executable===false&&a.data?.[1]==='base64','invalid record owner');
  const b=Buffer.from(a.data[0],'base64');assert.equal(b.length,SPACE,'record size');
  assert.equal(b[0],1,'record version');assert.equal(keystring(b.subarray(1,33)),operator,'record authority');return b;
}
export async function unchanged(rpc,a,record,operator,genesis,wanted,now,clock) {
  const b=accountBytes(a,operator);
  const magic=b.subarray(33,41).toString();
  if(['NKORAF01','NKORAL02'].includes(magic))return false;
  assert.equal(magic,MAGIC,'unknown listing format');
  if(b.subarray(41,43).toString()==='{"'){
    const end=b.indexOf(0,41),old=JSON.parse(b.subarray(41,end<0?b.length:end));
    assert.equal(old.v,1,'unknown legacy format');return false;
  }
  const n=b.readUInt16LE(41);assert(n>0&&43+n+64<=b.length,'bad record length');
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(43,43+n)));
  if(Number.isInteger(body.v)&&body.v>=1&&body.v<=4)return false;
  assert.equal(body.v,5,'unsupported listing');assert(integer(body.anchor_slot)&&body.anchor_slot<=now.slot,'future anchor');
  const anchor=body.anchor_slot===now.slot?now:await anchorAt(rpc,body.anchor_slot);
  assert(anchor.time<=clock,'future anchor time');
  // Authenticate even an expired old record before deciding whether to replace it.
  const old=readRecord(record,a,genesis,{nowUnixSeconds:anchor.time,anchorSlot:anchor.slot,anchorBlockhash:anchor.hash,anchorBlockTime:anchor.time});
  delete old.anchor_slot;delete old.anchor_blockhash;
  return JSON.stringify(canonical(old))===JSON.stringify(canonical(wanted))&&clock-anchor.time<RENEW_AFTER;
}
export function syncDir(dir) {
  // Windows cannot fsync a directory via Node. No power-loss durability claim there.
  if(process.platform==='win32')return;
  const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
export function writeNew(file,value) {
  const fd=fs.openSync(file,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  syncDir(path.dirname(file));
}
function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
export function lockState(dir) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const stat=fs.lstatSync(dir);
  assert(stat.isDirectory()&&!stat.isSymbolicLink(),'state must be a real directory');
  if(process.platform!=='win32')assert((stat.mode&0o077)===0&&stat.uid===process.getuid(),'state must be private and owned by service user');
  const lock=path.join(dir,'runner.lock');
  // No host-clock stale-lock eviction: a crash requires an explicit operator check.
  fs.mkdirSync(lock,{mode:0o700});
  try{writeNew(path.join(lock,'owner.json'),{pid:process.pid});}catch(e){fs.rmSync(lock,{recursive:true});throw e;}
  return ()=>{fs.rmSync(lock,{recursive:true});syncDir(dir);};
}
export async function reconcile(rpc,dir,record,genesis) {
  const floorFile=path.join(dir,'finalized.json'),pending=path.join(dir,'pending.json');let floor=0;
  if(fs.existsSync(floorFile)){const f=readJSON(floorFile);assert(f.record===record&&f.genesis===genesis&&integer(f.slot),'invalid finalized state');floor=f.slot;}
  if(!fs.existsSync(pending))return floor;
  const receipt=readJSON(pending);assert(receipt.record===record&&receipt.genesis===genesis,'wrong receipt identity');
  assert(typeof receipt.signature==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(receipt.signature),'bad receipt signature');
  const response=await rpc('getSignatureStatuses',[[receipt.signature],{searchTransactionHistory:true}]);const s=response?.value?.[0];
  assert(s&&s.err===null&&s.confirmationStatus==='finalized'&&integer(s.slot),'pending transaction unresolved; retain journal');
  const archive=path.join(dir,receipt.signature+'.json');
  if(fs.existsSync(archive))assert.deepEqual(readJSON(archive),receipt,'conflicting archived receipt');else writeNew(archive,receipt);
  floor=Math.max(floor,s.slot);const tmp=path.join(dir,'finalized.tmp');
  if(fs.existsSync(tmp))fs.unlinkSync(tmp);writeNew(tmp,{record,genesis,slot:floor});fs.renameSync(tmp,floorFile);syncDir(dir);
  fs.unlinkSync(pending);syncDir(dir);return floor;
}
function recordInstruction(operator,record,tag,data=Buffer.alloc(0)) {
  const accounts=[{address:record,role:1},{address:operator,role:tag===0?0:2}];
  if(tag===3)accounts.push({address:operator,role:1});
  let bytes=Buffer.from([tag]);
  if(tag===1){bytes=Buffer.alloc(13);bytes[0]=1;bytes.writeUInt32LE(data.length,9);bytes=Buffer.concat([bytes,data]);}
  return {programAddress:PROGRAM,accounts,data:bytes};
}
export function frame(terms) {
  const body=Buffer.from(JSON.stringify(canonical(terms))),payload=Buffer.alloc(SPACE-33);
  assert(body.length+74<=payload.length,'listing exceeds fixed record size');
  payload.write(MAGIC);payload.writeUInt16LE(body.length,8);body.copy(payload,10);
  return {body,payload,signatureOffset:10+body.length};
}
async function rawSign(signer,operator,message) {
  assert.equal(signer.address,operator,'signer identity mismatch');
  const [dictionary]=await signer.signMessages([{content:new Uint8Array(message),signatures:{}}]);
  const sig=Buffer.from(dictionary[operator]);assert(verifyAttestation(operator,message,sig),'invalid signer response');return sig;
}
function transaction(operator,blockhash,instructions) {
  let message=createTransactionMessage({version:'legacy'});
  message=setTransactionMessageFeePayer(operator,message);
  message=setTransactionMessageLifetimeUsingBlockhash({blockhash,lastValidBlockHeight:0n},message);
  return compileTransaction(appendTransactionMessageInstructions(instructions,message));
}
export async function publish({rpc,operator,genesis=GENESIS,terms,stateDir,action='renew',loadSigner,notify=()=>{},wait=delay}) {
  keybytes(operator);keybytes(genesis);assert(['renew','publish','close','check'].includes(action),'unknown action');
  const record=recordAddress(operator),unlock=lockState(stateDir);
  try {
    assert.equal(await rpc('getGenesisHash'),genesis,'wrong network');
    const floor=await reconcile(rpc,stateDir,record,genesis);
    const result=await rpc('getAccountInfo',[record,{...finalized,encoding:'base64',minContextSlot:floor}]);
    assert(integer(result?.context?.slot)&&result.context.slot>=floor,'stale account read');let current=result.value;
    const instructions=[];
    if(current?.owner===system&&current.executable===false&&current.data?.[1]==='base64'&&Buffer.from(current.data[0],'base64').length===0&&action!=='close'){
      assert(integer(current.lamports),'unsafe prefunding amount');
      instructions.push(getTransferSolWithSeedInstruction({source:record,baseAccount:createNoopSigner(operator),destination:operator,amount:current.lamports,fromSeed:SEED,fromOwner:PROGRAM}));current=null;
    }
    if(current)accountBytes(current,operator);else if(action==='close')return {record,status:'absent'};
    let framed;
    if(action!=='close') {
      assert(terms?.operator===operator&&terms.genesis===genesis&&terms.v===5,'wrong publication identity');
      const now=await anchorAt(rpc,await rpc('getSlot',[finalized]));const clock=await chainTime(rpc,now.slot);
      assert(clock>=now.time&&clock-now.time<=60,'fresh finalized anchor required');
      if(current&&await unchanged(rpc,current,record,operator,genesis,terms,now,clock))return {record,status:'unchanged'};
      if(action==='check')return {record,status:'renewal-required'};
      framed=frame({...terms,anchor_slot:now.slot,anchor_blockhash:now.hash});
      if(!current){const rent=await rpc('getMinimumBalanceForRentExemption',[SPACE,finalized]);assert(integer(rent)&&rent<=7000000,'rent cap');
        instructions.push(getCreateAccountWithSeedInstruction({payer:createNoopSigner(operator),newAccount:record,base:operator,baseAccount:createNoopSigner(operator),seed:SEED,amount:rent,space:SPACE,programAddress:PROGRAM}),recordInstruction(operator,record,0));}
      instructions.push(recordInstruction(operator,record,1,framed.payload));
    }else instructions.push(recordInstruction(operator,record,3));
    const latest=await rpc('getLatestBlockhash',[finalized]);keybytes(latest?.value?.blockhash);
    let tx=transaction(operator,latest.value.blockhash,instructions);
    const fee=await rpc('getFeeForMessage',[Buffer.from(tx.messageBytes).toString('base64'),finalized]);
    assert(integer(fee?.value)&&fee.value<=10000,'network fee cap');
    assert(getTransactionEncoder().encode(tx).length<=1232,'transaction size cap');
    const signer=await loadSigner();assert.equal(signer.address,operator,'signer identity mismatch');
    if(framed){const sig=await rawSign(signer,operator,attestationMessage(record,genesis,framed.body));sig.copy(framed.payload,framed.signatureOffset);instructions[instructions.length-1]=recordInstruction(operator,record,1,framed.payload);tx=transaction(operator,latest.value.blockhash,instructions);}
    const signature=await rawSign(signer,operator,tx.messageBytes);tx={...tx,signatures:{[operator]:signature}};
    const serialized=Buffer.from(getTransactionEncoder().encode(tx)),expected=getBase58Decoder().decode(signature);
    // Persist the actual transaction signature before handing bytes to any RPC.
    writeNew(path.join(stateDir,'pending.json'),{record,signature:expected,genesis});notify({record,signature:expected,status:'journaled'});
    const sent=await rpc('sendTransaction',[serialized.toString('base64'),{encoding:'base64',skipPreflight:false,preflightCommitment:'finalized',maxRetries:2}]);
    assert.equal(sent,expected,'RPC returned wrong signature; retain journal');
    for(let i=0;i<45;i++){
      const statuses=await rpc('getSignatureStatuses',[[expected],{searchTransactionHistory:true}]);const s=statuses?.value?.[0];
      assert(!s?.err,'transaction failed; retain journal');
      if(s?.confirmationStatus==='finalized'){await reconcile(rpc,stateDir,record,genesis);return {record,status:'finalized',signature:expected,fee:fee.value};}
      await wait(1000);
    }
    throw new Error('confirmation timed out; retain journal');
  }finally{unlock();}
}
