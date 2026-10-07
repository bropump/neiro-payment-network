import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {attestationMessage,keybytes,keystring,verifyAttestation,readRecord,recordAddress,PROGRAM} from './read-record.mjs';
const fixture={genesis:'11111111111111111111111111111111',account:{owner:PROGRAM,executable:false}};
const {genesis}=fixture;
const keys=generateKeyPairSync('ed25519');
const operator=keystring(keys.publicKey.export({format:'der',type:'spki'}).subarray(-32));
const record=recordAddress(operator);
const original={v:1,url:'https://operator.example/',operator,payment:operator,mint:'CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump',genesis,oracle:'Jupiter',price:{type:'margin',margin:0.05}};
const old=Buffer.alloc(733);old[0]=1;keybytes(operator).copy(old,1);old.write('NKORAF01',33);old.write(JSON.stringify(original),41);
const anchorTime=1800000000;
const chainContext={nowUnixSeconds:anchorTime,anchorSlot:123456,anchorBlockhash:PROGRAM,anchorBlockTime:anchorTime};
const terms={...original,v:5,operator,payment:operator,anchor_slot:chainContext.anchorSlot,anchor_blockhash:chainContext.anchorBlockhash};
function signed(body=terms, pair=keys) {
 const data=Buffer.alloc(733),bytes=Buffer.from(JSON.stringify(body));
 data[0]=1;keybytes(operator).copy(data,1);data.write('NEIRO069',33);data.writeUInt16LE(bytes.length,41);bytes.copy(data,43);
 sign(null,attestationMessage(record,genesis,bytes),pair.privateKey).copy(data,43+bytes.length);
 return {...structuredClone(fixture.account),data:[data.toString('base64'),'base64']};
}
const account=signed();
const copy=()=>structuredClone(account);
function edit(fn,base=account) { const a=structuredClone(base),data=Buffer.from(a.data[0],'base64'); fn(data); a.data[0]=data.toString('base64'); return a; }
test('signed NEIRO069 v5 authenticates anchored operator terms',()=>{
  const body=readRecord(record,account,genesis,chainContext);
  assert.equal(recordAddress(body.operator),record);
  assert.equal(body.price.margin,0.05);
  assert.equal(body.url,'https://operator.example/');
  assert.equal('exp' in body,false);
});
for(const [name,mutate] of [
  ['owner',a=>({...a,owner:'11111111111111111111111111111111'})],
  ['executable',a=>({...a,executable:true})],
  ['authority',()=>edit(b=>b[1]^=1)],
  ['record version',()=>edit(b=>b[0]=0)],
  ['format',()=>edit(b=>b[33]^=1)],
  ['padding',()=>edit(b=>b[b.length-1]=1)],
  ['size',()=>edit(b=>{} )],
]) test(`rejects wrong ${name}`,()=>{
  let a=mutate(copy());
  if(name==='size')a.data[0]=Buffer.from(a.data[0],'base64').subarray(0,732).toString('base64');
  assert.throws(()=>readRecord(record,a,genesis,chainContext));
});
test('copying an authentic payload to another address does not impersonate the operator',()=>{
  assert.throws(()=>readRecord(PROGRAM,account,genesis,chainContext),/seeded address/);
});
test('mainnet reader rejects a record published on the local cluster',()=>{
  assert.throws(()=>readRecord(record,account,'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'),/attestation|network/);
});
test('payload operator cannot differ from account authority',()=>{
  const a=edit(b=>{
    const end=43+b.readUInt16LE(41); const body=JSON.parse(b.subarray(43,end));
    body.operator='11111111111111111111111111111111'; b.fill(0,43,end); b.write(JSON.stringify(body),43);
  });
  assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation|authority/);
});

test('legacy marker is rejected rather than silently treated as the new format',()=>{
  assert.throws(()=>readRecord(record,{...fixture.account,data:[Buffer.from(old).toString('base64'),'base64']},genesis));
});

for(const price of [{type:'free'},{type:'fixed',amount:3000000,token:'CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump',strict:true}]) {
 test(`authenticates ${price.type} listing with unchanged format`,()=>{
  const a=signed({...terms,price});
  assert.deepEqual(readRecord(record,a,genesis,chainContext).price,price);
 });
}

for(const [field,value] of [['url','https://attacker.example/'],['payment',PROGRAM],['price',{type:'free'}],['oracle','Mock'],['genesis',PROGRAM]]) {
 test(`fabricated RPC response cannot change signed ${field}`,()=>{
  const a=edit(b=>{
   const end=43+b.readUInt16LE(41),sig=Buffer.from(b.subarray(end,end+64));
   const body=JSON.parse(b.subarray(43,end));body[field]=value;
   const bytes=Buffer.from(JSON.stringify(body));b.fill(0,41);b.writeUInt16LE(bytes.length,41);bytes.copy(b,43);sig.copy(b,43+bytes.length);
  });
  assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
 });
}
test('another wallet cannot sign Bunny-style terms with a copied authority header',()=>{
 assert.throws(()=>readRecord(record,signed(terms,generateKeyPairSync('ed25519')),genesis),/attestation/);
});
test('unsigned v1 with correct marker and derived address is rejected',()=>{
 const a=edit(b=>{b.fill(0,41);b.write(JSON.stringify({...terms,v:1}),41);});
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/unsigned/);
});
test('missing signature is rejected',()=>{
 const a=edit(b=>b.fill(0,43+b.readUInt16LE(41)));
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
});
test('signature cannot be transplanted from a different record',()=>{
 const a=edit(b=>{const end=43+b.readUInt16LE(41);sign(null,attestationMessage(PROGRAM,genesis,b.subarray(43,end)),keys.privateKey).copy(b,end);});
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
});
test('noncanonical signature scalar is rejected',()=>{
 const a=edit(b=>{const offset=43+b.readUInt16LE(41)+32;const order=(1n<<252n)+27742317777372353535851937790883648493n;
  const scalar=BigInt('0x'+Buffer.from(b.subarray(offset,offset+32)).reverse().toString('hex'))+order;
  Buffer.from(scalar.toString(16).padStart(64,'0'),'hex').reverse().copy(b,offset);
 });
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
});
test('small-order identity key cannot forge an attestation',()=>{
 const identity=Buffer.alloc(32);identity[0]=1;const sig=Buffer.alloc(64);identity.copy(sig);
 assert.equal(verifyAttestation(keystring(identity),Buffer.from('forged'),sig),false);
});
test('oversized or zero body length is rejected before parsing',()=>{
 for(const length of [0,627,65535])assert.throws(()=>readRecord(record,edit(b=>b.writeUInt16LE(length,41)),genesis),/length/);
});

test('persistent v4 fixture is rejected by renewal-network discovery',()=>{
 const f=JSON.parse(readFileSync(new URL('./signed-record.fixture.json',import.meta.url)));
 assert.throws(()=>readRecord(f.record,f.account,f.genesis,chainContext),/anchored v5 required/);
});

for (const [field,value] of [['sig_alg','none'],['sig_enc','base64'],['msg_id','NEIRO069-MSG2'],['signer',PROGRAM],['v',3]]) {
 test(`rejects correctly signed but unsupported ${field}`,()=>{
  assert.throws(()=>readRecord(record,signed({...terms,[field]:value}),genesis));
 });
 test(`RPC cannot alter signed metadata ${field}`,()=>{
  const a=edit(b=>{
   const end=43+b.readUInt16LE(41),sig=Buffer.from(b.subarray(end,end+64));
   const body={...terms,[field]:value},raw=Buffer.from(JSON.stringify(body));
   b.fill(0,41);b.writeUInt16LE(raw.length,41);raw.copy(b,43);sig.copy(b,43+raw.length);
  });
  assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
 });
}
test('signed v2 fixture is rejected without an implicit format fallback',()=>{
 const f=JSON.parse(readFileSync(new URL('./signed-record-v2.fixture.json',import.meta.url)));
 assert.throws(()=>readRecord(f.record,f.account,f.genesis),/attestation/);
});
test('the same JSON signed without the record or network binding is rejected',()=>{
 const a=edit(b=>{const end=43+b.readUInt16LE(41);sign(null,b.subarray(43,end),keys.privateKey).copy(b,end);});
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
});

test('an operator may explicitly sign a separate fee-receiving address',()=>{
 const body=readRecord(record,signed({...terms,payment:PROGRAM}),genesis,chainContext);
 assert.equal(body.operator,operator);
 assert.equal(body.payment,PROGRAM);
 assert.notEqual(body.operator,body.payment);
});
test('verification uses stored bytes, never reconstructed JSON',()=>{
 const raw=Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(terms).reverse())).replaceAll(',',', '));
 assert.deepEqual(JSON.parse(raw),terms);
 const a=edit(b=>{
  b.fill(0,41);b.writeUInt16LE(raw.length,41);raw.copy(b,43);
  sign(null,attestationMessage(record,genesis,raw),keys.privateKey).copy(b,43+raw.length);
 });
 assert.deepEqual(readRecord(record,a,genesis,chainContext),terms);
 const original=Buffer.from(account.data[0],'base64'),end=43+original.readUInt16LE(41);
 const b=Buffer.from(a.data[0],'base64');original.subarray(end,end+64).copy(b,43+raw.length);
 a.data[0]=b.toString('base64');
 assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
});

test('v3 proof and metadata cannot be accepted as v5',()=>{
 const f=JSON.parse(readFileSync(new URL('./signed-record-v3.fixture.json',import.meta.url)));
 assert.throws(()=>readRecord(f.record,f.account,f.genesis),/attestation/);
});
test('v5 retains exactly the agreed prefix, record, genesis and JSON bytes',()=>{
 const raw=Buffer.from(JSON.stringify(terms));
 const expected=Buffer.concat([Buffer.from('NEIRO069-MSG1','ascii'),Buffer.from([0]),keybytes(record),keybytes(genesis),raw]);
 assert.deepEqual(attestationMessage(record,genesis,raw),expected);
});

test('v5 remains valid at the 24-hour renewal point and immediately before 48-hour expiry',()=>{
 for(const elapsed of [0,86400,172799]) {
  assert.deepEqual(readRecord(record,account,genesis,{...chainContext,nowUnixSeconds:anchorTime+elapsed}),terms);
 }
});
test('v5 expires exactly 48 hours after the finalized anchor block time',()=>{
 for(const elapsed of [172800,172801]) {
  assert.throws(()=>readRecord(record,account,genesis,{...chainContext,nowUnixSeconds:anchorTime+elapsed}),/expired/);
 }
});
test('v5 rejects future anchor block times without clock-skew allowances',()=>{
 assert.throws(()=>readRecord(record,account,genesis,{...chainContext,nowUnixSeconds:anchorTime-1}),/future/);
});
test('v5 fails closed without independently supplied finalized chain context',()=>{
 for(const context of [undefined,null,anchorTime,{},[]]) {
  assert.throws(()=>readRecord(record,account,genesis,context),/trusted/);
 }
});
for(const field of ['nowUnixSeconds','anchorSlot','anchorBlockTime']) {
 test(`v5 requires trusted ${field} as a nonnegative safe integer`,()=>{
  for(const value of [undefined,null,'1800000000',NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
   assert.throws(()=>readRecord(record,account,genesis,{...chainContext,[field]:value}),new RegExp(field));
  }
 });
}
test('v5 requires a signed nonnegative safe integer anchor slot',()=>{
 for(const value of [null,'123456',-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
  assert.throws(()=>readRecord(record,signed({...terms,anchor_slot:value}),genesis,chainContext),/anchor_slot/);
 }
});
test('v5 requires valid 32-byte base58 block hashes in both terms and trusted context',()=>{
 for(const value of [undefined,null,123,'0'.repeat(32),'1'.repeat(31),'1'.repeat(45)]) {
  assert.throws(()=>readRecord(record,signed({...terms,anchor_blockhash:value}),genesis,chainContext));
  assert.throws(()=>readRecord(record,account,genesis,{...chainContext,anchorBlockhash:value}));
 }
});
test('v5 rejects a slot or block hash that does not match trusted chain data',()=>{
 assert.throws(()=>readRecord(record,account,genesis,{...chainContext,anchorSlot:chainContext.anchorSlot+1}),/anchor slot mismatch/);
 assert.throws(()=>readRecord(record,account,genesis,{...chainContext,anchorBlockhash:genesis}),/anchor blockhash mismatch/);
 assert.throws(()=>readRecord(record,signed({...terms,anchor_slot:chainContext.anchorSlot+1}),genesis,chainContext),/anchor slot mismatch/);
 assert.throws(()=>readRecord(record,signed({...terms,anchor_blockhash:genesis}),genesis,chainContext),/anchor blockhash mismatch/);
});
for(const [field,value] of [['anchor_slot',123457],['anchor_blockhash',genesis]]) {
 test(`RPC cannot alter signed ${field}`,()=>{
  const a=edit(b=>{
   const end=43+b.readUInt16LE(41),sig=Buffer.from(b.subarray(end,end+64));
   const raw=Buffer.from(JSON.stringify({...terms,[field]:value}));
   b.fill(0,41);b.writeUInt16LE(raw.length,41);raw.copy(b,43);sig.copy(b,43+raw.length);
  });
  assert.throws(()=>readRecord(record,a,genesis,chainContext),/attestation/);
 });
 test(`v5 requires signed ${field} without fallback`,()=>{
  const body={...terms};delete body[field];
  assert.throws(()=>readRecord(record,signed(body),genesis,chainContext),/signed fields/);
 });
}
test('operator-selected timestamps or expiry settings cannot override fixed chain-derived expiry',()=>{
 for(const [field,value] of [['issued_at',anchorTime],['expires_at',anchorTime+999999],['ttl',999999],['renewal',999999]]) {
  assert.throws(()=>readRecord(record,signed({...terms,[field]:value}),genesis,chainContext),/signed fields/);
 }
 const {anchor_slot,anchor_blockhash,...legacy}=terms;
 assert.throws(()=>readRecord(record,signed({...legacy,v:4}),genesis,chainContext),/anchored v5 required/);
 assert.throws(()=>readRecord(record,signed({...legacy,issued_at:anchorTime,expires_at:anchorTime+172800}),genesis,chainContext),/signed fields/);
});
test('v5 handles timestamp and slot integer boundaries without overflow',()=>{
 for(const value of [0,Number.MAX_SAFE_INTEGER]) {
  const body={...terms,anchor_slot:value};
  const context={...chainContext,anchorSlot:value,anchorBlockTime:value,nowUnixSeconds:value};
  assert.deepEqual(readRecord(record,signed(body),genesis,context),body);
 }
 const context={...chainContext,nowUnixSeconds:Number.MAX_SAFE_INTEGER,anchorBlockTime:Number.MAX_SAFE_INTEGER-172800};
 assert.throws(()=>readRecord(record,account,genesis,context),/expired/);
});
test('v5 requires the signed network to match the expected network',()=>{
 assert.throws(()=>readRecord(record,signed({...terms,genesis:PROGRAM}),genesis,chainContext),/network/);
});
