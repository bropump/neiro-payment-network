import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'smol-toml';
import {protectText,protectFile} from './protect.ts';
const operator='S42G16e52WiSRuBS49DNSNsWEx1CmysRfmuguEbotyg';
test('README protect command works on the shipped Kora template without changing policies or comments',()=>{
 const text=fs.readFileSync(new URL('../../../examples/operator/kora.toml',import.meta.url),'utf8');
 const before=parse(text),r=protectText(text,operator),after=parse(r.text);
 assert(r.changed);assert.equal(r.record,'AUcq2QhmqGAH4QSm5qMPnfZb6TcEoKVF8fHGg9FnWKfo');
 assert.deepEqual(after.validation.disallowed_accounts,[r.record,...before.validation.disallowed_accounts]);
 after.validation.disallowed_accounts=before.validation.disallowed_accounts;assert.deepEqual(after,before);
 assert.equal(r.text.replace(JSON.stringify(r.record)+', ',''),text);
 assert.equal(protectText(r.text,operator).changed,false);
});
test('existing other deny entries remain in their original order',()=>{
 const t='[validation]\ndisallowed_accounts = ["11111111111111111111111111111111"]\n';
 const r=protectText(t,operator);assert.equal(parse(r.text).validation.disallowed_accounts[1],'11111111111111111111111111111111');
});
test('unsupported TOML spelling fails without changing file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neiro-protect-'));try{
 const file=path.join(dir,'kora.toml'),text='["validation"]\ndisallowed_accounts=[]\n';fs.writeFileSync(file,text);
 assert.throws(()=>protectFile(file,operator));assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(fs.readdirSync(dir).length,1);
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('new deny list can be added without overwriting a neighboring table',()=>{
 const t='[validation]\nmax_allowed_lamports=250000000\n[kora]\nrate_limit=100\n';
 const r=protectText(t,operator);assert.equal(parse(r.text).kora.rate_limit,100);assert.equal(parse(r.text).validation.max_allowed_lamports,250000000);
});
