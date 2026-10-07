// Local config edit only: no credentials, RPC, signing, or service restart.
import fs from 'node:fs';
import {isUtf8} from 'node:buffer';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'smol-toml';
import {recordAddress} from '../client/read-record.mjs';
import {syncDir, jsonObject} from './publisher.ts';
export function protectText(text: string,operator: string) {
  const record=recordAddress(operator),config=parse(text),v=jsonObject(config.validation);
  assert(v&&typeof v==='object'&&!Array.isArray(v),'validation table required');
  const old=v.disallowed_accounts??[];
  assert(Array.isArray(old)&&old.every(x=>typeof x==='string'),'disallowed_accounts must be an array of addresses');
  if(old.includes(record))return {record,text,changed:false};
  // Find only an ordinary [validation] table. Other TOML forms fail without editing.
  const header=/^[ \t]*\[validation\][ \t]*(?:#[^\r\n]*)?\r?$/gm;
  const hits=[...text.matchAll(header)];assert.equal(hits.length,1,'use a [validation] table before running protect');
  const start=hits[0].index+hits[0][0].length-(hits[0][0].endsWith('\r')?1:0);
  const rest=text.slice(start),next=rest.search(/^[ \t]*\[\[?[^\r\n]+\]\]?[ \t]*(?:#[^\r\n]*)?\r?$/m);
  const end=next<0?text.length:start+next,section=text.slice(start,end);
  const assignments=[...section.matchAll(/^[ \t]*disallowed_accounts[ \t]*=[ \t]*\[/gm)];
  let updated;
  if(v.disallowed_accounts!==undefined){
    assert.equal(assignments.length,1,'use disallowed_accounts = [...] inside [validation]');
    const at=start+assignments[0].index+assignments[0][0].length;
    updated=text.slice(0,at)+JSON.stringify(record)+', '+text.slice(at);
  }else{
    assert.equal(assignments.length,0,'unexpected deny entry');
    const newline=text.includes('\r\n')?'\r\n':'\n';
    updated=text.slice(0,start)+newline+'disallowed_accounts = ['+JSON.stringify(record)+']'+text.slice(start);
  }
  v.disallowed_accounts=[record,...old];
  // No other semantic setting may change. Comments and unrelated bytes stay intact.
  assert.deepEqual(parse(updated),config,'config edit changed unrelated settings');
  return {record,text:updated,changed:true};
}
export function protectFile(filename: string,operator: string) {
  const file=path.resolve(filename),stat=fs.lstatSync(file);
  assert(stat.isFile()&&!stat.isSymbolicLink(),'config must be a regular file, not a symlink');
  if(process.platform!=='win32')assert.equal(stat.uid,process.getuid!(),'config must belong to this service user');
  const original=fs.readFileSync(file);assert(isUtf8(original),'config must contain valid UTF-8');
  const result=protectText(original.toString('utf8'),operator);
  if(!result.changed)return {record:result.record,changed:false};
  const backup=file+'.before-neiro-'+randomUUID(),temp=file+'.neiro-'+randomUUID();
  const save=(name: string,data: string | Uint8Array)=>{const fd=fs.openSync(name,'wx',0o600);try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
  try{
    save(backup,original);save(temp,result.text);
    if(process.platform!=='win32'){
      // Preserve ownership before restoring mode; chown failure leaves the original untouched.
      fs.chownSync(temp,stat.uid,stat.gid);fs.chmodSync(temp,stat.mode&0o777);
    }
    syncDir(path.dirname(file));
    const now=fs.lstatSync(file);
    assert(now.isFile()&&!now.isSymbolicLink()&&now.ino===stat.ino&&fs.readFileSync(file).equals(original),'config changed during protection setup');
    fs.renameSync(temp,file);syncDir(path.dirname(file));
    return {record:result.record,changed:true,backup};
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
