// Independent review regression: never combine a newer expiry height with an older status root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {reconcile} from './publisher.ts';
import {recordAddress,keystring} from '../client/read-record.mjs';
test('legacy recovery cannot use a newer height with a pre-expiry finalized status context',async t=>{
 const pair=generateKeyPairSync('ed25519');
 const operator=keystring(pair.publicKey.export({format:'der',type:'spki'}).subarray(-32));
 const record=recordAddress(operator),genesis='11111111111111111111111111111111',signature='1'.repeat(64);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'npn-expiry-context-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'pending.json'),JSON.stringify({record,genesis,signature}));
 const rpc=async(method,params)=>{
  if(method==='getSignatureStatuses')return {context:{slot:100},value:[null]};
  if(method==='getSlot')return 100;
  if(method==='getBlockHeight')return 200; // different load-balanced server, ahead of root/status server
  if(method==='getBlock')return {blockHeight:params[0],blockhash:genesis,blockTime:1000};
  if(method==='getTransaction')return null;
  if(method==='getAccountInfo')return {context:{slot:100},value:null};
  throw Error('Unexpected RPC '+method);
 };
 await assert.rejects(reconcile(rpc,dir,record,genesis,{operator,legacyRecovery:{signature,beforeSlot:0}}),/LEGACY_EXPIRY_WAIT/);
 assert(fs.existsSync(path.join(dir,'pending.json')));
});
test('malformed finalized status never consumes the journal as a failed transaction',async t=>{
 const pair=generateKeyPairSync('ed25519'),operator=keystring(pair.publicKey.export({format:'der',type:'spki'}).subarray(-32));
 const record=recordAddress(operator),genesis='11111111111111111111111111111111',signature='1'.repeat(64);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'npn-malformed-status-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'pending.json');fs.writeFileSync(file,JSON.stringify({record,genesis,signature}));
 const rpc=async()=>({context:{slot:100},value:[{slot:100,confirmationStatus:'finalized'}]});
 await assert.rejects(reconcile(rpc,dir,record,genesis,{operator}));
 assert(fs.existsSync(file),'missing err must retain pending, not classify it as a finalized failure');
});
test('finalized string TransactionError is archived rather than permanently blocking recovery',async t=>{
 const pair=generateKeyPairSync('ed25519'),operator=keystring(pair.publicKey.export({format:'der',type:'spki'}).subarray(-32));
 const record=recordAddress(operator),genesis='11111111111111111111111111111111',signature='1'.repeat(64);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'npn-string-error-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'pending.json');fs.writeFileSync(file,JSON.stringify({record,genesis,signature}));
 const rpc=async()=>({context:{slot:100},value:[{slot:100,confirmationStatus:'finalized',err:'AccountNotFound'}]});
 await assert.rejects(reconcile(rpc,dir,record,genesis,{operator}),/TRANSACTION_FINALIZED_FAILED/);
 assert(!fs.existsSync(file));
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,signature+'.outcome.json'))).outcome,'failed');
});
