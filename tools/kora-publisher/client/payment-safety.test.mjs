import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {classicAtaRent, completedTransferCost, assertProductInstructionsUnchanged,
  releasePaymentOnce} from './payment-safety.example.mjs';
import {NEIRO, verifyQuote} from './verify-quote.mjs';
import {keybytes} from './read-record.mjs';

const wallet = 'CJydC3eEX92owxWSsaRH9k2RhWp9vLbsSkswrW9CPsp';
const operator = 'ComzC9Pit9DUQhcnadSv2ipZwL5awucoCWc9k6Up2uqi';
const rent = 2_039_280;
function account() {
  const data = Buffer.alloc(165);
  keybytes(NEIRO).copy(data); keybytes(wallet).copy(data, 32); data[108] = 1;
  return {owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable:false,
    lamports:rent, data:[data.toString('base64'), 'base64']};
}
const cost = a => classicAtaRent({account:a, mint:NEIRO, wallet, rentExemptLamports:rent});
test('absent ATA costs rent; initialized existing ATA costs zero', () => {
  assert.equal(cost(null), BigInt(rent));
  assert.equal(cost(account()), 0n);
  assert.equal(completedTransferCost({networkFeeLamports:10_000, recipientRentLamports:cost(account())}), 10_000n);
  assert.equal(completedTransferCost({networkFeeLamports:10_000, recipientRentLamports:cost(null)}), 2_049_280n);
});
test('RPC error/missing result is not account absence', () => {
  for (const value of [undefined, {}, {error:{message:'unavailable'}}]) assert.throws(() => cost(value));
});
test('wrong program, mint, wallet, uninitialized/frozen and unsupported data reject', () => {
  const a = account();
  assert.throws(() => cost({...a, owner:'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'}));
  assert.throws(() => cost({...a, executable:true}));
  for (const offset of [0,32,108]) {
    const bytes=Buffer.from(a.data[0], 'base64'); bytes[offset]^=1;
    assert.throws(() => cost({...a, data:[bytes.toString('base64'),'base64']}));
  }
  const frozen=Buffer.from(a.data[0], 'base64'); frozen[108]=2;
  assert.throws(() => cost({...a,data:[frozen.toString('base64'),'base64']}));
  assert.throws(() => cost({...a,lamports:-1}));
  assert.throws(() => cost({...a,data:[Buffer.alloc(166).toString('base64'),'base64']}));
});
test('initialized existing ATA below the reported new-account minimum adds no new rent', () => {
  assert.equal(cost({...account(),lamports:1_488_440}),0n);
});
test('missing, negative, unsafe or overflowing network cost rejects', () => {
  for (const networkFeeLamports of [null, undefined, -1, Number.MAX_SAFE_INTEGER+1, 1n<<64n]) {
    assert.throws(() => completedTransferCost({networkFeeLamports, recipientRentLamports:0n}));
  }
});
test('Neutral Trade receipt regression: repeated existing rent is an overcharge', () => {
  const listing={operator,payment:operator,mint:NEIRO,oracle:'Mock',price:{type:'margin',margin:0.05}};
  const config={fee_payers:[operator],validation_config:{price:listing.price,price_source:'Mock',allowed_spl_paid_tokens:[NEIRO]}};
  const quote={signer_pubkey:operator,payment_address:operator,fee_in_lamports:6_302_688,fee_in_token:6_302_688};
  const args={listing,config,quote,costLamports:3_963_280,oracle:{source:'Mock',tokenPriceSol:'0.001',blockId:100},currentSlot:100,maxFeeRaw:10_000_000};
  assert.throws(() => verifyQuote(args), /disagree/);
  assert.equal(verifyQuote({...args,quote:{...quote,fee_in_lamports:4_161_444,fee_in_token:4_161_444}}).feeRaw,4_161_444n);
});
test('captured swap quoted-output or signer mutation is rejected by the instruction guard', () => {
  const fixture=JSON.parse(readFileSync(new URL('./bisonfi-swap.fixture.json',import.meta.url),'utf8'));
  const approved=[fixture.swapInstruction];
  assertProductInstructionsUnchanged(approved, structuredClone(approved));
  const weakened=structuredClone(approved);
  // Reproduce the trial's alteration of this specific captured Jupiter layout.
  // This offset is NOT a decoder for arbitrary Jupiter instruction versions.
  const data=Buffer.from(weakened[0].data,'base64');data.writeBigUInt64LE(1n,25);
  weakened[0].data=data.toString('base64');
  assert.throws(() => assertProductInstructionsUnchanged(approved,weakened), /product instructions changed/);
  const redirected=structuredClone(approved);redirected[0].accounts[1].pubkey=operator;
  assert.throws(() => assertProductInstructionsUnchanged(approved,redirected), /product instructions changed/);
});
const attempt={approvedMessageBase64:'AQ==',customerSignedTransactionBase64:'Ag==',operator,
  blockhash:wallet,lastValidBlockHeight:123,maxFeeRaw:'5000000',operation:{transferRaw:'1'}};
test('lost operator response preserves journal and prevents new signing on restart', async t => {
  const dir=mkdtempSync(join(tmpdir(),'npn-once-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const op=join(dir,'payment-1');let preparations=0, releases=0;
  await assert.rejects(releasePaymentOnce(op, async()=>{preparations++;return attempt}, async x=>{
    releases++;assert.deepEqual(JSON.parse(readFileSync(join(op,'pending.json'),'utf8')),x);
    throw new Error('response lost after possible broadcast');
  }),/response lost/);
  await assert.rejects(releasePaymentOnce(op, async()=>{preparations++;return attempt}, async()=>{releases++}),/EEXIST/);
  assert.equal(preparations,1);assert.equal(releases,1);
  assert.deepEqual(JSON.parse(readFileSync(join(op,'pending.json'),'utf8')),attempt);
});
test('preparation failure leaves operation reserved; no signature is released', async t => {
  const dir=mkdtempSync(join(tmpdir(),'npn-prepare-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const op=join(dir,'payment');let sent=false;
  await assert.rejects(releasePaymentOnce(op,async()=>{throw Error('simulation rejected')},async()=>{sent=true}));
  assert.equal(sent,false);assert.equal(existsSync(join(op,'pending.json')),false);
  await assert.rejects(releasePaymentOnce(op,async()=>attempt,async()=>{}),/EEXIST/);
});
test('two processes competing for one operation permit at most one prepare/release', async t => {
  const dir=mkdtempSync(join(tmpdir(),'npn-concurrent-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'worker.mjs');
  writeFileSync(file,`import {releasePaymentOnce} from ${JSON.stringify(new URL('./payment-safety.example.mjs',import.meta.url).href)};
    import {appendFileSync} from 'node:fs';
    try { await releasePaymentOnce(process.argv[2],async()=>{appendFileSync(process.argv[3],'prepare\\n');return ${JSON.stringify(attempt)}},async()=>{appendFileSync(process.argv[3],'release\\n')}); }
    catch(e) { if(e.code!=='EEXIST') throw e; }`);
  const run=()=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[file,join(dir,'payment'),join(dir,'calls')],{stdio:'pipe'});let error='';p.stderr.on('data',x=>error+=x);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(error)));});
  await Promise.all([run(),run()]);
  assert.equal(readFileSync(join(dir,'calls'),'utf8'),'prepare\nrelease\n');
});
