// Private operator administration. Never call this through a public Kora signing endpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createTransactionMessage,setTransactionMessageFeePayer,setTransactionMessageLifetimeUsingBlockhash,appendTransactionMessageInstructions,getCompiledTransactionMessageDecoder} from '@solana/transaction-messages';
import {compileTransaction,getTransactionEncoder,getTransactionDecoder} from '@solana/transactions';
import {getBase58Decoder} from '@solana/codecs-strings';
import {getCreateAccountWithSeedInstruction,getTransferSolWithSeedInstruction,SYSTEM_PROGRAM_ADDRESS} from '@solana-program/system';
import {parse} from 'smol-toml';
import {createNoopSigner} from '@solana/signers';
import {PROGRAM, MINT, MAGIC, SEED, recordAddress, keybytes, keystring,
  attestationMessage, verifyAttestation, readRecord} from '../client/read-record.mjs';
import {validatePrice} from '../client/verify-quote.mjs';
import {address} from '@solana/addresses';
import {blockhash} from '@solana/rpc-types';
import {assertIsSignatureBytes} from '@solana/keys';
import type {Instruction, AccountMeta} from '@solana/instructions';
import type {MessagePartialSigner} from '@solana/signers';
export type JsonObject = Record<string, unknown>;
export type Rpc = (method: string, params?: readonly unknown[] | JsonObject) => Promise<unknown>;
export interface RpcAccount {owner: string; executable: boolean; data: [string, string]; lamports: unknown}
export interface Anchor {slot: number; hash: string; time: number}
export interface Terms {v: 5; operator: string; payment: string; url: string; mint: string; genesis: string; oracle: string; price: unknown}
export type Action = 'renew' | 'publish' | 'close' | 'check';
interface PublishOptions {
  rpc: Rpc; operator: string; genesis?: string; terms?: Terms; stateDir: string; action?: Action;
  loadSigner: () => Promise<MessagePartialSigner>;
  notify?: (event: {record: string; signature: string; status: 'journaled'}) => void;
  wait?: (milliseconds: number) => Promise<unknown>;
  legacyRecovery?: {signature: string; beforeSlot: number};
}
export function jsonObject(value: unknown): JsonObject {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'JSON object required');
  return value as JsonObject;
}
export function jsonParse(text: string): unknown { return JSON.parse(text) as unknown; }
export function rpcAccount(value: unknown): RpcAccount {
  const a=jsonObject(value);
  assert(typeof a.owner==='string' && typeof a.executable==='boolean' && Array.isArray(a.data) &&
    a.data.length===2 && typeof a.data[0]==='string' && typeof a.data[1]==='string','invalid account response');
  return {owner:a.owner,executable:a.executable,data:[a.data[0],a.data[1]],lamports:a.lamports};
}
function accountResult(value: unknown): {context: {slot: number}; value: RpcAccount | null} {
  const r=jsonObject(value),context=jsonObject(r.context);assert(integer(context.slot),'invalid RPC context');
  return {context:{slot:context.slot},value:r.value===null?null:rpcAccount(r.value)};
}
function firstStatus(value: unknown): JsonObject | null {
  const response=jsonObject(value);assert(Array.isArray(response.value)&&response.value.length===1,'invalid signature statuses');
  if(response.value[0]===null)return null;
  const s=jsonObject(response.value[0]);assert(s.err===null||(s.err!==null&&(typeof s.err==='object'||typeof s.err==='string')),'invalid transaction error');return s;
}
export const GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const SPACE=733, RENEW_AFTER=86400;
const finalized={commitment:'finalized'}, system=SYSTEM_PROGRAM_ADDRESS;
const integer=(n: unknown): n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const includes=(xs: unknown,value: unknown)=>Array.isArray(xs)&&xs.includes(value);
export function canonical(value: unknown): unknown {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(jsonObject(value)[k])]));
  assert(typeof value!=='bigint' && (typeof value!=='number'||Number.isFinite(value)),'unsupported JSON value');
  return value;
}
export function rpcClient(url: string): Rpc {
  const u=new URL(url);
  assert(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname)),'RPC requires HTTPS or loopback');
  let id=0;
  return async (method: string,params: readonly unknown[] | JsonObject=[])=>{
    const requestId=++id;
    try {
    const r=await fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new RecoveryError(`RPC_${method}_HTTP_${r.status}`);
    const chunks: Uint8Array[]=[];let size=0;assert(r.body,'empty RPC response');
    for await(const chunk of r.body){size+=chunk.length;assert(size<=8*1024*1024,'RPC response too large');chunks.push(chunk);}
    const x=jsonObject(jsonParse(Buffer.concat(chunks).toString()));
    if(x.error)throw new RecoveryError(`RPC_${method}_REJECTED`);
    assert(x.jsonrpc==='2.0'&&x.id===requestId,'invalid RPC envelope');
    return x.result;
    } catch(error){if(error instanceof RecoveryError)throw error;throw new RecoveryError(`RPC_${method}_TRANSPORT_OR_RESPONSE`);}
  };
}
export async function anchorAt(rpc: Rpc,slot: unknown): Promise<Anchor> {
  assert(integer(slot),'invalid anchor slot');
  const b=jsonObject(await rpc('getBlock',[slot,{...finalized,transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0}]));
  assert(integer(b.blockTime),'missing block time');assert(typeof b.blockhash==='string','blockhash required');keybytes(b.blockhash);
  return {slot,hash:b.blockhash,time:b.blockTime};
}
export async function chainTime(rpc: Rpc,minSlot: number) {
  const r=accountResult(await rpc('getAccountInfo',['SysvarC1ock11111111111111111111111111111111',{...finalized,encoding:'base64',minContextSlot:minSlot}]));
  assert(integer(r?.context?.slot)&&r.context.slot>=minSlot,'stale Clock context');
  const a=r.value;
  assert(a?.owner==='Sysvar1111111111111111111111111111111111111'&&a.executable===false&&a.data?.[1]==='base64','invalid Clock');
  const b=Buffer.from(a.data[0],'base64');assert.equal(b.length,40,'Clock length');
  const slot=b.readBigUInt64LE(),time=b.readBigInt64LE(32);
  assert(slot>=BigInt(minSlot)&&slot<=BigInt(r.context.slot),'inconsistent Clock slot');
  assert(time>=0n&&time<=BigInt(Number.MAX_SAFE_INTEGER),'invalid Clock timestamp');return Number(time);
}
export function termsFromConfig(text: string,operator: string,url: string,genesis: string,liveValue: unknown,payerValue: unknown): Terms {
  const live=jsonObject(liveValue),payer=jsonObject(payerValue);
  const cfg=jsonObject(parse(text)),v=jsonObject(cfg.validation);
  keybytes(operator);keybytes(genesis);
  const u=new URL(url);assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash,'public HTTPS URL required');
  const record=recordAddress(operator),payment=(cfg.kora===undefined?undefined:jsonObject(cfg.kora).payment_address)||operator;
  assert(typeof payment==='string','payment address required');
  keybytes(payment);validatePrice(v.price);
  assert(includes(v.allowed_tokens,MINT),'NEIRO not allowed');
  assert(v.allowed_spl_paid_tokens==='All'||includes(v.allowed_spl_paid_tokens,MINT),'NEIRO fees not allowed');
  assert(includes(v.disallowed_accounts,record),'private config must deny listing');
  assert(includes(live?.fee_payers,operator),'operator not served');
  const actual=jsonObject(live.validation_config);
  assert(includes(actual?.disallowed_accounts,record),'live Kora must deny listing');
  assert(includes(actual.allowed_tokens,MINT),'live NEIRO not allowed');
  assert(actual.allowed_spl_paid_tokens==='All'||includes(actual.allowed_spl_paid_tokens,MINT),'live NEIRO fees not allowed');
  assert.deepEqual(canonical(actual.price),canonical(v.price),'live price mismatch');
  assert.equal(actual.price_source,v.price_source,'live oracle mismatch');
  assert(typeof v.price_source==='string'&&['Jupiter','Mock','CoinGecko'].includes(v.price_source),'unknown price source');
  assert.equal(payer?.signer_address,operator,'live signer mismatch');
  assert.equal(payer?.payment_address,payment,'live payment mismatch');
  return {v:5,operator,payment,url:u.href,mint:MINT,genesis,oracle:v.price_source,price:v.price};
}
function accountBytes(a: RpcAccount,operator: string) {
  assert(a?.owner===PROGRAM&&a.executable===false&&a.data?.[1]==='base64','invalid record owner');
  const b=Buffer.from(a.data[0],'base64');assert.equal(b.length,SPACE,'record size');
  assert.equal(b[0],1,'record version');assert.equal(keystring(b.subarray(1,33)),operator,'record authority');return b;
}
export async function unchanged(rpc: Rpc,a: RpcAccount,record: string,operator: string,genesis: string,wanted: Terms,now: Anchor,clock: number) {
  const b=accountBytes(a,operator);
  const magic=b.subarray(33,41).toString();
  if(['NKORAF01','NKORAL02'].includes(magic))return false;
  assert.equal(magic,MAGIC,'unknown listing format');
  if(b.subarray(41,43).toString()==='{"'){
    const end=b.indexOf(0,41),old=jsonObject(jsonParse(b.subarray(41,end<0?b.length:end).toString()));
    assert.equal(old.v,1,'unknown legacy format');return false;
  }
  const n=b.readUInt16LE(41);assert(n>0&&43+n+64<=b.length,'bad record length');
  const body=jsonObject(jsonParse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(43,43+n))));
  if(typeof body.v==='number'&&Number.isInteger(body.v)&&body.v>=1&&body.v<=4)return false;
  assert.equal(body.v,5,'unsupported listing');assert(integer(body.anchor_slot)&&body.anchor_slot<=now.slot,'future anchor');
  const anchor=body.anchor_slot===now.slot?now:await anchorAt(rpc,body.anchor_slot);
  assert(anchor.time<=clock,'future anchor time');
  // Authenticate even an expired old record before deciding whether to replace it.
  const old=readRecord(record,a,genesis,{nowUnixSeconds:anchor.time,anchorSlot:anchor.slot,anchorBlockhash:anchor.hash,anchorBlockTime:anchor.time});
  delete old.anchor_slot;delete old.anchor_blockhash;
  return JSON.stringify(canonical(old))===JSON.stringify(canonical(wanted))&&clock-anchor.time<RENEW_AFTER;
}
export function syncDir(dir: string) {
  // Windows cannot fsync a directory via Node. No power-loss durability claim there.
  if(process.platform==='win32')return;
  const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
export function writeNew(file: string,value: unknown) {
  const fd=fs.openSync(file,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  syncDir(path.dirname(file));
}
function readJSON(file: string): JsonObject{return jsonObject(jsonParse(fs.readFileSync(file,'utf8')));}
export function lockState(dir: string) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const stat=fs.lstatSync(dir);
  assert(stat.isDirectory()&&!stat.isSymbolicLink(),'state must be a real directory');
  if(process.platform!=='win32')assert((stat.mode&0o077)===0&&stat.uid===process.getuid!(),'state must be private and owned by service user');
  const lock=path.join(dir,'runner.lock');
  // No host-clock stale-lock eviction: a crash requires an explicit operator check.
  fs.mkdirSync(lock,{mode:0o700});
  try{writeNew(path.join(lock,'owner.json'),{pid:process.pid});}catch(e){fs.rmSync(lock,{recursive:true});throw e;}
  return ()=>{fs.rmSync(lock,{recursive:true});syncDir(dir);};
}
// Only fixed error codes cross the log boundary; RPC/signer errors may contain secrets.
export class RecoveryError extends Error {
  readonly code: string;
  constructor(code: string) {super(code);this.code=code;}
}
export function safeErrorCode(error: unknown): string {
  if(error instanceof RecoveryError)return error.code;
  const code=error instanceof Error?(error as NodeJS.ErrnoException).code:undefined;
  return ['EEXIST','EACCES','EPERM','ENOSPC','ENOENT'].includes(code??'')?`STATE_${code}`:'VALIDATION_OR_SIGNER_FAILED';
}
interface RecoveryOptions {
  operator?: string; action?: Action; legacyRecovery?: {signature: string; beforeSlot: number};
}
function saveFloor(dir: string,record: string,genesis: string,slot: number) {
  const tmp=path.join(dir,'finalized.tmp');
  if(fs.existsSync(tmp))fs.unlinkSync(tmp);
  writeNew(tmp,{record,genesis,slot});fs.renameSync(tmp,path.join(dir,'finalized.json'));syncDir(dir);
}
function archivePending(dir: string,receipt: JsonObject,outcome: string,floor: number) {
  // Persist the receipt and watermark before removing pending. All steps are repeatable after a crash.
  const archive=path.join(dir,String(receipt.signature)+'.json');
  if(fs.existsSync(archive))assert.deepEqual(readJSON(archive),receipt,'conflicting archived receipt');else writeNew(archive,receipt);
  const evidence=path.join(dir,String(receipt.signature)+'.outcome.json');
  if(!fs.existsSync(evidence))writeNew(evidence,{outcome,slot:floor});
  saveFloor(dir,String(receipt.record),String(receipt.genesis),floor);
  fs.unlinkSync(path.join(dir,'pending.json'));syncDir(dir);
}
function signedReceipt(receipt: JsonObject,operator: string) {
  assert(receipt.v===2&&receipt.operator===operator,'invalid pending schema or operator');
  assert(typeof receipt.transaction==='string'&&typeof receipt.blockhash==='string'&&integer(receipt.lastValidBlockHeight)&&integer(receipt.contextSlot),'invalid pending lifetime');
  const bytes=Buffer.from(receipt.transaction,'base64');assert(bytes.length<=1232&&bytes.toString('base64')===receipt.transaction,'invalid pending bytes');
  const tx=getTransactionDecoder().decode(bytes),message=getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  assert(message.version==='legacy'&&message.staticAccounts[0]===operator&&message.staticAccounts.includes(address(String(receipt.record))),'invalid pending accounts');
  assert(message.lifetimeToken===receipt.blockhash,'pending blockhash mismatch');
  assert.deepEqual(Object.keys(tx.signatures),[operator],'invalid pending signers');
  const sig=tx.signatures[address(operator)];assert(sig&&verifyAttestation(operator,new Uint8Array(tx.messageBytes),sig),'invalid pending signature');
  assert(getBase58Decoder().decode(sig)===receipt.signature,'pending signature mismatch');
  assert(['renew','publish','close'].includes(String(receipt.action)),'invalid pending action');
  return {bytes:receipt.transaction,blockhash:receipt.blockhash,height:receipt.lastValidBlockHeight,slot:receipt.contextSlot};
}
async function statusAt(rpc: Rpc,signature: string,minSlot: number) {
  const r=jsonObject(await rpc('getSignatureStatuses',[[signature],{searchTransactionHistory:true}]));
  const context=jsonObject(r.context);assert(integer(context.slot)&&context.slot>=minSlot,'stale signature context');
  const status=firstStatus(r);
  if(status)assert(integer(status.slot)&&status.slot<=context.slot&&['processed','confirmed','finalized'].includes(String(status.confirmationStatus)),'invalid signature status');
  return status;
}
export async function reconcile(rpc: Rpc,dir: string,record: string,genesis: string,options: RecoveryOptions={}) {
  const floorFile=path.join(dir,'finalized.json'),pending=path.join(dir,'pending.json');let floor=0;
  if(fs.existsSync(floorFile)){const f=readJSON(floorFile);assert(f.record===record&&f.genesis===genesis&&integer(f.slot),'invalid finalized state');floor=f.slot;}
  if(!fs.existsSync(pending))return floor;
  const receipt=readJSON(pending);assert(receipt.record===record&&receipt.genesis===genesis,'wrong receipt identity');
  assert(typeof receipt.signature==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(receipt.signature),'bad receipt signature');
  const modern=receipt.v===2;
  const wire=modern?signedReceipt(receipt,options.operator??String(receipt.operator)):null;
  if(!modern)assert.deepEqual(Object.keys(receipt).sort(),['genesis','record','signature'],'unknown legacy receipt');
  const finish=(s: JsonObject)=>{
    assert(integer(s.slot)&&(s.err===null||(s.err!==null&&(typeof s.err==='object'||typeof s.err==='string'))),'invalid finalized result');floor=Math.max(floor,s.slot);
    archivePending(dir,receipt,s.err===null?'finalized':'failed',floor);
    if(s.err!==null)throw new RecoveryError('TRANSACTION_FINALIZED_FAILED');
    return floor;
  };
  let status=await statusAt(rpc,receipt.signature,Math.max(floor,wire?.slot??0));
  if(status?.confirmationStatus==='finalized')return finish(status);
  // Establish an expiry observation, THEN read status/account at or after that finalized root.
  const root=await rpc('getSlot',[finalized]);assert(integer(root)&&root>=floor&&root>=(wire?.slot??0),'stale finalized root');
  const rootedBlock=jsonObject(await rpc('getBlock',[root,{...finalized,transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0}]));
  const height=rootedBlock.blockHeight;assert(integer(height),'invalid rooted block height');
  let expired=false;
  if(wire){
    if(height>wire.height){
      const valid=jsonObject(await rpc('isBlockhashValid',[wire.blockhash,{...finalized,minContextSlot:root}]));
      const ctx=jsonObject(valid.context);assert(integer(ctx.slot)&&ctx.slot>=root&&typeof valid.value==='boolean','invalid blockhash validity');
      if(valid.value)throw new RecoveryError('RPC_EXPIRY_CONFLICT');
      expired=true;
    }else{
      if(options.action!=='check'&&!status){
        if(options.action&&receipt.action!==options.action)throw new RecoveryError('PENDING_ACTION_MISMATCH');
        const sent=await rpc('sendTransaction',[wire.bytes,{encoding:'base64',skipPreflight:false,preflightCommitment:'finalized',maxRetries:2}]);
        assert.equal(sent,receipt.signature,'RPC returned wrong signature; retain journal');
      }
      throw new RecoveryError('PENDING_STILL_VALID');
    }
  }else{
    const proof=options.legacyRecovery;
    if(!proof||proof.signature!==receipt.signature)throw new RecoveryError('LEGACY_RECOVERY_REQUIRED');
    assert(integer(proof.beforeSlot)&&proof.beforeSlot<=root,'legacy cutoff must be finalized');
    const cutoff=jsonObject(await rpc('getBlock',[proof.beforeSlot,{...finalized,transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0}]));
    assert(integer(cutoff.blockHeight),'legacy cutoff block unavailable');
    // Explicit operator assertion: this old publisher attempt used a recent hash from <= beforeSlot,
    // never a durable nonce. 160 rooted produced blocks exceeds Solana's 151-hash processing window.
    if(height<=cutoff.blockHeight+160)throw new RecoveryError('LEGACY_EXPIRY_WAIT');
    const proofFile=path.join(dir,receipt.signature+'.legacy-proof.json');
    const evidence={signature:receipt.signature,beforeSlot:proof.beforeSlot,cutoffHeight:cutoff.blockHeight};
    if(fs.existsSync(proofFile))assert.deepEqual(readJSON(proofFile),evidence,'legacy proof changed');else writeNew(proofFile,evidence);
    expired=true;
  }
  assert(expired);
  status=await statusAt(rpc,receipt.signature,root);
  if(status?.confirmationStatus==='finalized')return finish(status);
  if(status)throw new RecoveryError('PENDING_NOT_FINALIZED');
  // A history lookup may find a transaction omitted from a provider's status index.
  const historical=await rpc('getTransaction',[receipt.signature,{...finalized,maxSupportedTransactionVersion:0}]);
  if(historical!==null){const h=jsonObject(historical),meta=jsonObject(h.meta);assert(integer(h.slot),'invalid transaction slot');return finish({slot:h.slot,err:meta.err});}
  const account=accountResult(await rpc('getAccountInfo',[record,{...finalized,encoding:'base64',minContextSlot:root}]));
  assert(account.context.slot>=root,'stale recovery account');
  floor=Math.max(floor,root);archivePending(dir,receipt,'expired-unobserved',floor);
  return floor;
}
function recordInstruction(operator: string,record: string,tag: number,data: Uint8Array=Buffer.alloc(0)): Instruction {
  const accounts: AccountMeta[]=[{address:address(record),role:1},{address:address(operator),role:tag===0?0:2}];
  if(tag===3)accounts.push({address:address(operator),role:1});
  let bytes=Buffer.from([tag]);
  if(tag===1){bytes=Buffer.alloc(13);bytes[0]=1;bytes.writeUInt32LE(data.length,9);bytes=Buffer.concat([bytes,data]);}
  return {programAddress:address(PROGRAM),accounts,data:bytes};
}
export function frame(terms: unknown) {
  const body=Buffer.from(JSON.stringify(canonical(terms))),payload=Buffer.alloc(SPACE-33);
  assert(body.length+74<=payload.length,'listing exceeds fixed record size');
  payload.write(MAGIC);payload.writeUInt16LE(body.length,8);body.copy(payload,10);
  return {body,payload,signatureOffset:10+body.length};
}
async function rawSign(signer: MessagePartialSigner,operator: string,message: Uint8Array) {
  assert.equal(signer.address,operator,'signer identity mismatch');
  const [dictionary]=await signer.signMessages([{content:new Uint8Array(message),signatures:{}}]);
  assert(dictionary,'missing signer response');const sig=Buffer.from(dictionary[address(operator)]);assert(verifyAttestation(operator,message,sig),'invalid signer response');assertIsSignatureBytes(sig);return sig;
}
function transaction(operator: string,hash: string,height: number,instructions: Instruction[]) {
  const message=createTransactionMessage({version:'legacy'});
  const withPayer=setTransactionMessageFeePayer(address(operator),message);
  const withLifetime=setTransactionMessageLifetimeUsingBlockhash({blockhash:blockhash(hash),lastValidBlockHeight:BigInt(height)},withPayer);
  return compileTransaction(appendTransactionMessageInstructions(instructions,withLifetime));
}
export async function publish({rpc,operator,genesis=GENESIS,terms,stateDir,action='renew',loadSigner,notify=()=>{},wait=delay,legacyRecovery}: PublishOptions) {
  keybytes(operator);keybytes(genesis);assert(['renew','publish','close','check'].includes(action),'unknown action');
  const record=recordAddress(operator),unlock=lockState(stateDir);
  try {
    assert.equal(await rpc('getGenesisHash'),genesis,'wrong network');
    const floor=await reconcile(rpc,stateDir,record,genesis,{operator,action,legacyRecovery});
    const result=accountResult(await rpc('getAccountInfo',[record,{...finalized,encoding:'base64',minContextSlot:floor}]));
    assert(integer(result?.context?.slot)&&result.context.slot>=floor,'stale account read');let current=result.value;
    const instructions: Instruction[]=[];
    if(current?.owner===system&&current.executable===false&&current.data?.[1]==='base64'&&Buffer.from(current.data[0],'base64').length===0&&action!=='close'){
      assert(integer(current.lamports),'unsafe prefunding amount');
      instructions.push(getTransferSolWithSeedInstruction({source:address(record),baseAccount:createNoopSigner(address(operator)),destination:address(operator),amount:current.lamports,fromSeed:SEED,fromOwner:address(PROGRAM)}));current=null;
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
        instructions.push(getCreateAccountWithSeedInstruction({payer:createNoopSigner(address(operator)),newAccount:address(record),base:address(operator),baseAccount:createNoopSigner(address(operator)),seed:SEED,amount:rent,space:SPACE,programAddress:address(PROGRAM)}),recordInstruction(operator,record,0));}
      instructions.push(recordInstruction(operator,record,1,framed.payload));
    }else instructions.push(recordInstruction(operator,record,3));
    const latestResponse=jsonObject(await rpc('getLatestBlockhash',[finalized])),latestContext=jsonObject(latestResponse.context),latest=jsonObject(latestResponse.value);
    assert(integer(latestContext.slot)&&latestContext.slot>=floor&&integer(latest.lastValidBlockHeight),'invalid blockhash context/lifetime');assert(typeof latest.blockhash==='string','blockhash required');keybytes(latest.blockhash);
    let tx=transaction(operator,latest.blockhash,latest.lastValidBlockHeight,instructions);
    const fee=jsonObject(await rpc('getFeeForMessage',[Buffer.from(tx.messageBytes).toString('base64'),finalized]));
    assert(integer(fee?.value)&&fee.value<=10000,'network fee cap');
    assert(getTransactionEncoder().encode(tx).length<=1232,'transaction size cap');
    const signer=await loadSigner();assert.equal(signer.address,operator,'signer identity mismatch');
    if(framed){const sig=await rawSign(signer,operator,attestationMessage(record,genesis,framed.body));sig.copy(framed.payload,framed.signatureOffset);instructions[instructions.length-1]=recordInstruction(operator,record,1,framed.payload);tx=transaction(operator,latest.blockhash,latest.lastValidBlockHeight,instructions);}
    const signature=await rawSign(signer,operator,new Uint8Array(tx.messageBytes));tx={...tx,signatures:{[operator]:signature}};
    const serialized=Buffer.from(getTransactionEncoder().encode(tx)),expected=getBase58Decoder().decode(signature);
    // Persist the actual transaction signature before handing bytes to any RPC.
    writeNew(path.join(stateDir,'pending.json'),{v:2,record,signature:expected,genesis,operator,action,blockhash:latest.blockhash,lastValidBlockHeight:latest.lastValidBlockHeight,contextSlot:latestContext.slot,transaction:serialized.toString('base64')});notify({record,signature:expected,status:'journaled'});
    const sent=await rpc('sendTransaction',[serialized.toString('base64'),{encoding:'base64',skipPreflight:false,preflightCommitment:'finalized',maxRetries:2}]);
    assert.equal(sent,expected,'RPC returned wrong signature; retain journal');
    for(let i=0;i<45;i++){
      const s=firstStatus(await rpc('getSignatureStatuses',[[expected],{searchTransactionHistory:true}]));
      if(s?.err&&s.confirmationStatus!=='finalized')throw new RecoveryError('PENDING_NOT_FINALIZED');
      if(s?.confirmationStatus==='finalized'){await reconcile(rpc,stateDir,record,genesis,{operator,action,legacyRecovery});return {record,status:'finalized',signature:expected,fee:fee.value};}
      if(!s&&i>0&&i%5===0){const sent=await rpc('sendTransaction',[serialized.toString('base64'),{encoding:'base64',skipPreflight:false,preflightCommitment:'finalized',maxRetries:2}]);assert.equal(sent,expected,'RPC returned wrong signature; retain journal');}
      await wait(1000);
    }
    throw new RecoveryError('CONFIRMATION_TIMEOUT');
  }finally{unlock();}
}
