// Explicit local-only integration test; never reads production credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createMemorySigner} from '@solana/keychain-memory';
import {rpcClient,publish,anchorAt,chainTime} from './publisher.mjs';
import {MINT,recordAddress,readRecord} from '../client/read-record.mjs';
const url=process.env.SURFPOOL_RPC||'http://127.0.0.1:18997';assert.equal(new URL(url).hostname,'127.0.0.1');
const rpc=rpcClient(url),signer=await createMemorySigner({privateKey:new Uint8Array(randomBytes(32))}),operator=signer.address;
const genesis=await rpc('getGenesisHash'),record=recordAddress(operator),dir=fs.mkdtempSync(path.join(os.tmpdir(),'neiro-node-surfpool-'));
const out=process.env.EVIDENCE_DIR;assert(out,'EVIDENCE_DIR required');fs.mkdirSync(out,{recursive:true});
await rpc('surfnet_setAccount',[operator,{lamports:100000000}]);await rpc('surfnet_setAccount',[record,{lamports:1}]);
const terms={v:5,operator,payment:operator,url:'https://operator.example/',mint:MINT,genesis,oracle:'Jupiter',price:{type:'margin',margin:0.05}};
const options={rpc,operator,genesis,terms,stateDir:dir,loadSigner:async()=>signer};const results=[];
async function run(action='renew',extra={}) {const t=performance.now();const r=await publish({...options,action,...extra});results.push({...r,elapsed_ms:performance.now()-t});console.log(r.status,results.at(-1).elapsed_ms.toFixed(3),'ms');return r;}
async function snapshot(name){const a=(await rpc('getAccountInfo',[record,{encoding:'base64',commitment:'finalized'}])).value;const b=Buffer.from(a.data[0],'base64'),body=JSON.parse(b.subarray(43,43+b.readUInt16LE(41)));const anchor=await anchorAt(rpc,body.anchor_slot),now=await chainTime(rpc,anchor.slot);const context={nowUnixSeconds:now,anchorSlot:anchor.slot,anchorBlockhash:anchor.hash,anchorBlockTime:anchor.time};fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({record,genesis,account:a,context},null,2));return {a,context};}
assert.equal((await run()).status,'finalized');const first=await snapshot('created');assert(readRecord(record,first.a,genesis,first.context));const balance=async()=>(await rpc('getBalance',[operator,{commitment:'finalized'}])).value;
const before=await balance();assert.equal((await run()).status,'unchanged');assert.equal(await balance(),before);
await rpc('surfnet_timeTravel',[{absoluteTimestamp:(first.context.anchorBlockTime+86520)*1000}]);await delay(15000);
assert.equal((await run()).status,'finalized');const renewed=await snapshot('renewed');assert.equal(renewed.a.lamports,first.a.lamports);assert(readRecord(record,renewed.a,genesis,renewed.context));
assert.equal((await run('publish',{terms:{...terms,url:'https://changed.example/'}})).status,'finalized');const changed=await snapshot('changed');
await rpc('surfnet_timeTravel',[{absoluteTimestamp:(changed.context.anchorBlockTime+172920)*1000}]);await delay(15000);
const expired=await snapshot('expired');assert.throws(()=>readRecord(record,expired.a,genesis,expired.context),/expired/);
assert.equal((await run('close')).status,'finalized');assert.equal((await rpc('getAccountInfo',[record,{commitment:'finalized'}])).value,null);
const end=await balance();assert.equal(end,100000001-20000);assert(!fs.existsSync(path.join(dir,'pending.json')));assert(!fs.existsSync(path.join(dir,'runner.lock')));
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({operator,record,genesis,rent_recovered:first.a.lamports,final_balance:end,fees:20000,results},null,2));console.log('SURFPOOL PASS: create, no-op, daily renewal, config update, expiry, closure, prefund and rent recovery');
