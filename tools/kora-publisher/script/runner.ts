#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {GENESIS,rpcClient,termsFromConfig,publish,anchorAt,chainTime,jsonObject,jsonParse,rpcAccount} from './publisher.ts';
import {PROGRAM,MAGIC,recordAddress,readRecord} from '../client/read-record.mjs';
import {loadSigner} from './signer.ts';
import assert from 'node:assert/strict';
import type {Action} from './publisher.ts';
const isAction=(value: string): value is Action=>['check','renew','publish','close'].includes(value);
import {protectFile} from './protect.ts';
export async function main(args: string[]=process.argv.slice(2),env: NodeJS.ProcessEnv=process.env) {
  const {values:v,positionals}=parseArgs({args,allowPositionals:true,options:{
    operator:{type:'string'},url:{type:'string'},config:{type:'string',default:'kora.toml'},
    'signers-config':{type:'string',default:'signers.toml'},'signer-name':{type:'string'},
    'state-dir':{type:'string'},genesis:{type:'string',default:GENESIS},
    watch:{type:'boolean',default:false},help:{type:'boolean',default:false}
  }});
  if(v.help){console.log('node runner.ts protect|address|discover|check|renew|publish|close --operator PUBKEY --url HTTPS --config kora.toml --signers-config signers.toml --state-dir PRIVATE_DIR [--watch]\nUse SOLANA_RPC_URL for RPC, Kora signer environment for credentials. --watch checks hourly; unchanged terms sign only after 24 chain hours.');return;}
  if(positionals.length!==1)throw Error('one action required');
  const action=positionals[0];
  if(action==='protect'){assert(v.operator,'operator required');if(v.watch)throw Error('watch only supports renew');const result=protectFile(v.config,v.operator);console.log(JSON.stringify(result));console.log('Listing address added or already present. Restart every Kora instance using this key before starting the runner. No transaction sent.');return;}
  if(action==='address'){assert(v.operator,'operator required');console.log(recordAddress(v.operator));return;}
  const rpc=rpcClient(env.SOLANA_RPC_URL||env.RPC_URL||'https://api.mainnet-beta.solana.com');
  if(action==='discover') {
    if(v.watch)throw Error('watch only supports renew');
    if(await rpc('getGenesisHash')!==v.genesis)throw Error('wrong network');
    const records=await rpc('getProgramAccounts',[PROGRAM,{commitment:'finalized',encoding:'base64',filters:[{dataSize:733},{memcmp:{offset:33,bytes:Buffer.from(MAGIC).toString('base64'),encoding:'base64'}}]}]);
    if(!Array.isArray(records))throw Error('invalid discovery response');
    let rejected=0;
    for(const candidate of records){try{const r=jsonObject(candidate),account=rpcAccount(r.account);assert(typeof r.pubkey==='string','record address required');const b=Buffer.from(account.data[0],'base64'),n=b.readUInt16LE(41);if(n===0||43+n+64>b.length)throw Error('layout');const body=jsonObject(jsonParse(b.subarray(43,43+n).toString()));const a=await anchorAt(rpc,body.anchor_slot);
      const now=await chainTime(rpc,a.slot);
      const terms=readRecord(r.pubkey,account,v.genesis,{nowUnixSeconds:now,anchorSlot:a.slot,anchorBlockhash:a.hash,anchorBlockTime:a.time});console.log(JSON.stringify({record:r.pubkey,terms}));
    }catch{rejected++;}}
    console.log(JSON.stringify({scanned:records.length,rejected}));return;
  }
  if(!isAction(action)||!v.operator||!v['state-dir']||(action!=='close'&&!v.url))throw Error('missing or invalid command options');
  if(v.watch&&action!=='renew')throw Error('watch only supports renew');
  const stop=new AbortController();let stopping=false;
  const onStop=()=>{stopping=true;stop.abort();};process.on('SIGTERM',onStop);process.on('SIGINT',onStop);
  try {
    do {
      let stage='configuration';
      try {
        let terms;
        if(action!=='close'){
          // Validate the URL before making any request and never follow redirects.
          assert(v.url,'URL required');const u=new URL(v.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('public HTTPS URL required');
          const config=fs.readFileSync(v.config,'utf8'),kora=rpcClient(v.url);stage='live Kora configuration';
          const live=await kora('getConfig',{}),payer=await kora('getPayerSigner',{});
          terms=termsFromConfig(config,v.operator,v.url,v.genesis,live,payer);
        }
        stage='chain validation, signing or reconciliation';
        const result=await publish({rpc,operator:v.operator,genesis:v.genesis,terms,stateDir:path.resolve(v['state-dir']),action,
          loadSigner:()=>loadSigner(fs.readFileSync(v['signers-config'],'utf8'),v['signer-name'],env),notify:x=>console.log(JSON.stringify(x))});
        console.log(JSON.stringify(result));
      }catch{console.error(stage==='live Kora configuration'?'Kora configuration check failed. Check the URL, operator, fees and listing deny entry; restart Kora after editing its config. Nothing submitted.':`Listing check failed during ${stage}. Preserve pending.json and runner.lock; inspect service configuration and finalized chain state before recovery.`);if(!v.watch){process.exitCode=1;return;}}
      if(!v.watch||stopping)break;
      try{await delay(3600000,undefined,{signal:stop.signal});}catch{break;}
    }while(!stopping);
  }finally{process.off('SIGTERM',onStop);process.off('SIGINT',onStop);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Invalid runner configuration. Use --help. No private errors are logged.');process.exitCode=1;});
