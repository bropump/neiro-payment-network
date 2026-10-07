// Independent local-only config edit review. All files live in disposable temp directories.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'smol-toml';
import {protectText,protectFile} from './protect.ts';
import {main} from './runner.ts';
const operator='11111111111111111111111111111111';
function fixture(t,bytes='[validation]\nallowed_tokens=[]\n'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'protect-review-')),file=path.join(dir,'kora.toml');
 fs.writeFileSync(file,bytes,{mode:0o600});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,file};
}
test('missing deny key in CRLF config preserves original line endings and bytes',()=>{
 const original='# keep\r\n[validation] # table\r\nallowed_tokens=[] # keep too\r\n';
 const result=protectText(original,operator);assert(result.changed);
 assert.equal(result.text.replace(`disallowed_accounts = ["${result.record}"]\r\n`,''),original);
 assert.deepEqual(parse(result.text).validation.disallowed_accounts,[result.record]);
});
test('existing commented multiline list changes only the inserted account bytes',()=>{
 const original='# header\n[validation]\ndisallowed_accounts = [ # keep\n "11111111111111111111111111111111", # old\n]\n[other]\nx="preserve"\n';
 const result=protectText(original,operator);assert.equal(result.text.replace(JSON.stringify(result.record)+', ',''),original);
 assert.equal(parse(result.text).validation.disallowed_accounts.length,2);
});
test('lookalike header inside multiline value fails closed instead of modifying text',()=>{
 const original="notes = '''\n[validation]\n'''\n[validation]\nallowed_tokens=[]\n";
 assert.throws(()=>protectText(original,operator));
});
test('backup is exact, private, and second protect run does not mutate file or add backups',t=>{
 const {dir,file}=fixture(t);const original=fs.readFileSync(file),result=protectFile(file,operator);
 assert.equal(result.changed,true);assert(fs.readFileSync(result.backup).equals(original));
 if(process.platform!=='win32')assert.equal(fs.statSync(result.backup).mode&0o777,0o600);
 const before=fs.statSync(file),bytes=fs.readFileSync(file),names=fs.readdirSync(dir).sort();
 assert.equal(protectFile(file,operator).changed,false);assert.equal(fs.statSync(file).ino,before.ino);assert(fs.readFileSync(file).equals(bytes));assert.deepEqual(fs.readdirSync(dir).sort(),names);
});
test('invalid UTF-8 fails without silently rewriting unrelated comment bytes',t=>{
 const original=Buffer.concat([Buffer.from('# invalid '),Buffer.from([0xff]),Buffer.from('\n[validation]\nallowed_tokens=[]\n')]);
 const {dir,file}=fixture(t,original);assert.throws(()=>protectFile(file,operator));assert(fs.readFileSync(file).equals(original));assert.deepEqual(fs.readdirSync(dir),['kora.toml']);
});
test('symlink input is rejected without changing its target',t=>{
 const {dir,file}=fixture(t),link=path.join(dir,'link.toml'),original=fs.readFileSync(file);
 try{fs.symlinkSync(file,link,'file');}catch(e){if(process.platform==='win32'&&e.code==='EPERM'){t.skip('host denies unprivileged symlink creation');return;}throw e;}
 assert.throws(()=>protectFile(link,operator),/symlink/);assert(fs.readFileSync(file).equals(original));
});
for(const mode of ['in-place edit','atomic replacement'])test(`concurrent ${mode} before commit is preserved and protection stops`,t=>{
 const {dir,file}=fixture(t),original=fs.readFileSync(file),edited=Buffer.from('[validation]\nallowed_tokens=[]\n# external edit\n');
 const open=fs.openSync;let injected=false;
 fs.openSync=function(name,...args){
  if(!injected&&typeof name==='string'&&name.startsWith(file+'.neiro-')){injected=true;if(mode==='atomic replacement'){const replacement=path.join(dir,'external.tmp');fs.writeFileSync(replacement,edited);fs.renameSync(replacement,file);}else fs.writeFileSync(file,edited);}
  return open.call(fs,name,...args);
 };
 try{assert.throws(()=>protectFile(file,operator),/changed during/);}finally{fs.openSync=open;}
 assert(injected);assert(fs.readFileSync(file).equals(edited));const backups=fs.readdirSync(dir).filter(x=>x.includes('.before-neiro-'));assert.equal(backups.length,1);assert(fs.readFileSync(path.join(dir,backups[0])).equals(original));assert(!fs.readdirSync(dir).some(x=>x.startsWith('kora.toml.neiro-')));
});
test('protect CLI does not initialize RPC or read signer config',async t=>{
 const {file}=fixture(t),fetch=globalThis.fetch,log=console.log;let requests=0;globalThis.fetch=()=>{requests++;throw Error('no network expected');};console.log=()=>{};
 try{await main(['protect','--operator',operator,'--config',file,'--signers-config','/missing/never-read'],{SOLANA_RPC_URL:'not even a URL'});}finally{globalThis.fetch=fetch;console.log=log;}
 assert.equal(requests,0);assert.equal(parse(fs.readFileSync(file,'utf8')).validation.disallowed_accounts.length,1);
});
test('replacement preserves original config permissions while backup remains private',t=>{
 if(process.platform==='win32'){t.skip('POSIX permission bits are not available');return;}
 const {file}=fixture(t);fs.chmodSync(file,0o640);const result=protectFile(file,operator);
 assert.equal(fs.statSync(file).mode&0o777,0o640);assert.equal(fs.statSync(result.backup).mode&0o777,0o600);
});
test('replacement preserves the original config group',t=>{
 if(process.platform==='win32'){t.skip('POSIX groups are not available');return;}
 const {dir,file}=fixture(t),directoryGroup=fs.statSync(dir).gid;
 const group=process.getgroups().find(g=>g!==directoryGroup);
 if(group===undefined){t.skip('no supplementary group available for fixture');return;}
 try{fs.chownSync(file,process.getuid(),group);}catch(e){if(e.code==='EPERM'){t.skip('host cannot assign supplementary group');return;}throw e;}
 fs.chmodSync(file,0o640);protectFile(file,operator);
 assert.equal(fs.statSync(file).gid,group);assert.equal(fs.statSync(file).mode&0o777,0o640);
});
