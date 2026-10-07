// Reference reader: operator attestation bound to exact terms, network and derived record.
import assert from 'node:assert/strict';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {validatePrice} from './verify-quote.mjs';
export const PROGRAM='recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5';
export const MINT='CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump';
export const SEED='neiro-kora-fees';
export const MAGIC='NEIRO069';
export const DOMAIN=Buffer.from('NEIRO069-MSG1\0','ascii');
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function keybytes(text) {
  assert.equal(typeof text,'string','public key');
  assert.ok(text.length>=32 && text.length<=44,'public key length');
  let n=0n; for(const char of text){const digit=ALPHABET.indexOf(char);assert.ok(digit>=0,'base58');n=n*58n+BigInt(digit);}
  let hex=n.toString(16);if(hex.length%2)hex='0'+hex;
  const bytes=Buffer.concat([Buffer.alloc(text.match(/^1*/)[0].length),n?Buffer.from(hex,'hex'):Buffer.alloc(0)]);
  assert.equal(bytes.length,32,'public key bytes');return bytes;
}
export function keystring(bytes) {
  bytes=Buffer.from(bytes);assert.equal(bytes.length,32);
  let n=BigInt('0x'+bytes.toString('hex')),s='';while(n){s=ALPHABET[Number(n%58n)]+s;n/=58n;}
  let zeros=0;while(zeros<bytes.length && bytes[zeros]===0)zeros++;
  return '1'.repeat(zeros)+s;
}
export function attestationMessage(record,genesis,bodyBytes) {
  return Buffer.concat([DOMAIN,keybytes(record),keybytes(genesis),bodyBytes]);
}
const little=b=>BigInt('0x'+Buffer.from(b).reverse().toString('hex'));
const P=(1n<<255n)-19n,L=(1n<<252n)+27742317777372353535851937790883648493n;
// Small-order y coordinates (both sign bits), also rejected by strict Ed25519.
// See libsodium 1.0.18 ge25519_has_small_order; noncanonical y >= p is rejected too.
const SMALL=new Set([0n,1n,P-1n,2707385501144840649318225287225658788936804267575313519463743609750303402022n,55188659117513257062467267217118295137698188065244968500265048394206261417927n]);
function validPointEncoding(b){const y=little(b)&((1n<<255n)-1n);return y<P&&!SMALL.has(y);}
export function verifyAttestation(operator,message,signature) {
  const pub=keybytes(operator),sig=Buffer.from(signature);
  if(sig.length!==64||little(sig.subarray(32))>=L||!validPointEncoding(pub)||!validPointEncoding(sig.subarray(0,32)))return false;
  return verify(null,message,createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),pub]),format:'der',type:'spki'}),sig);
}
export function recordAddress(operator) {
  return keystring(createHash('sha256').update(Buffer.concat([
    keybytes(operator),Buffer.from(SEED),keybytes(PROGRAM)
  ])).digest());
}
// Obtain this context independently from trusted finalized chain data on
// expectedGenesis: current UNIX seconds plus the signed slot's block hash/time.
// Never use operator-provided timestamps or treat a missing block as unexpired.
// Legacy persistent records are not accepted by renewal-network discovery.
export function readRecord(record,account,expectedGenesis,trustedChainContext) {
  assert.ok(account && account.owner===PROGRAM && account.executable===false,'owner/account');
  assert.equal(account.data?.[1],'base64','encoding');
  const data=Buffer.from(account.data[0],'base64');
  assert.equal(data.length,733,'size');
  assert.equal(data[0],1,'record version');
  const authority=keystring(data.subarray(1,33));
  assert.equal(record,recordAddress(authority),'seeded address');
  assert.equal(data.subarray(33,41).toString(),MAGIC,'format');
  const length=data.readUInt16LE(41),end=43+length;
  assert.ok(length>0 && end+64<=data.length,'signed body length; unsigned listings unsupported');
  assert.ok(data.subarray(end+64).every(b=>b===0),'padding');
  const bytes=data.subarray(43,end),sig=data.subarray(end,end+64);
  assert.ok(verifyAttestation(authority,attestationMessage(record,expectedGenesis,bytes),sig),'invalid operator attestation');
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  assert.equal(body.v,5,'signed schema; anchored v5 required');
  assert.deepEqual(Object.keys(body).sort(),['anchor_blockhash','anchor_slot','genesis','mint','operator','oracle','payment','price','url','v'],'signed fields');
  assert.ok(Number.isSafeInteger(body.anchor_slot) && body.anchor_slot>=0,'anchor_slot integer');
  keybytes(body.anchor_blockhash);
  assert.ok(trustedChainContext && typeof trustedChainContext==='object','trusted finalized chain context required');
  const {nowUnixSeconds,anchorSlot,anchorBlockhash,anchorBlockTime}=trustedChainContext;
  for(const [field,value] of Object.entries({nowUnixSeconds,anchorSlot,anchorBlockTime})) {
    assert.ok(Number.isSafeInteger(value) && value>=0,`trusted ${field} integer required`);
  }
  keybytes(anchorBlockhash);
  assert.equal(body.anchor_slot,anchorSlot,'anchor slot mismatch');
  assert.equal(body.anchor_blockhash,anchorBlockhash,'anchor blockhash mismatch');
  assert.ok(anchorBlockTime<=nowUnixSeconds,'anchor block time in future');
  assert.ok(nowUnixSeconds-anchorBlockTime<172800,'listing expired');
  assert.equal(body.operator,authority,'operator authority');
  assert.equal(body.mint,MINT,'mint');
  assert.equal(body.genesis,expectedGenesis,'network');
  validatePrice(body.price);
  keybytes(body.payment); keybytes(expectedGenesis);
  const url=new URL(body.url);
  assert.ok((url.protocol==='https:' || body.url==='http://127.0.0.1:18080/') &&
    !url.username && !url.password && !url.search && !url.hash,'public URL');
  assert.equal(url.href,body.url,'normalized URL');
  return body;
}
