// Companion to tests/surfpool.rs. Reads public evidence; does not submit transactions.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {readRecord} from './read-record.mjs';
const dir=process.argv[2];
assert.ok(dir,'usage: node verify-surfpool.mjs EVIDENCE_DIRECTORY');
const read=name=>JSON.parse(readFileSync(join(dir,name+'.json'),'utf8'));
for(const name of ['created','renewed']) {
  const x=read(name);
  const terms=readRecord(x.record,x.account,x.genesis,x.context);
  assert.equal(terms.v,5);
  console.log(name+': authentic and unexpired');
}
const expired=read('expired');
assert.throws(()=>readRecord(expired.record,expired.account,expired.genesis,expired.context),/expired/);
console.log('expired: rejected using Surfpool chain time');
const fresh=read('renewed');
const context={...fresh.context,nowUnixSeconds:fresh.context.anchorBlockTime+172799};
readRecord(fresh.record,fresh.account,fresh.genesis,context);
assert.throws(()=>readRecord(fresh.record,fresh.account,fresh.genesis,{...context,nowUnixSeconds:context.nowUnixSeconds+1}),/expired/);
console.log('exact verifier boundary: accepts 172799s; rejects 172800s (injected context)');
const oldNow=Date.now;
try { Date.now=()=>{throw new Error('host clock must not be used')};readRecord(fresh.record,fresh.account,fresh.genesis,fresh.context); }
finally { Date.now=oldNow; }
console.log('reader does not consult the host wall clock');
const summary=read('summary');
assert.equal(summary.network_fees,20000);assert.ok(summary.rent_recovered>0);
console.log(JSON.stringify(summary));
