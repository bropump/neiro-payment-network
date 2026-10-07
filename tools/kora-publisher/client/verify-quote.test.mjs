import test from 'node:test';
import assert from 'node:assert/strict';
import {NEIRO,verifyQuote,validatePrice} from './verify-quote.mjs';
const OP='ANYLfraNjYogERmhLaKfb3Vd183QFZyVb8oLTdU2Xp2N';
function fixture(price={type:'margin',margin:0.05},lamports=10500,raw=2625000) {
  return {
    listing:{operator:OP,payment:OP,mint:NEIRO,oracle:'Jupiter',price},
    config:{fee_payers:[OP],validation_config:{price:structuredClone(price),price_source:'Jupiter',allowed_spl_paid_tokens:[NEIRO]}},
    quote:{signer_pubkey:OP,payment_address:OP,fee_in_lamports:lamports,fee_in_token:raw},
    costLamports:10000,oracle:{source:'Jupiter',blockId:1000,tokenPriceSol:'0.000004'},currentSlot:1150,
  };
}
test('margin: 10000 lamports + 5%, at 0.000004 SOL/NEIRO',()=>assert.equal(verifyQuote(fixture()).feeRaw,2625000n));
test('margin rounds fractional lamports upward before token conversion',()=>{
  const f=fixture({type:'margin',margin:0.05},10502,2625500); f.costLamports=10001;
  assert.equal(verifyQuote(f).feeLamports,10502n);
});
test('free quote is zero without any oracle or cost input',()=>{
  const f=fixture({type:'free'},0,null); delete f.oracle; delete f.costLamports; delete f.currentSlot;
  assert.equal(verifyQuote(f).feeRaw,0n);
});
test('free accepts explicit zero token fee',()=>assert.equal(verifyQuote(fixture({type:'free'},0,0)).feeRaw,0n));
for (const strict of [false,true]) test(`fixed 3 NEIRO, strict=${strict}`,()=>{
  const f=fixture({type:'fixed',amount:3000000,token:NEIRO,strict},12000,3000000);
  assert.equal(verifyQuote(f).feeRaw,3000000n);
});
test('fixed floors token-to-lamports then ceils back, rather than claiming byte-exact fixed tokens',()=>{
  const f=fixture({type:'fixed',amount:3000001,token:NEIRO,strict:false},12000,3000000);
  assert.equal(verifyQuote(f).feeRaw,3000000n);
});
test('fixed non-strict may subsidize cost; does not increase the fee',()=>{
  const f=fixture({type:'fixed',amount:2000000,token:NEIRO,strict:false},8000,2000000);
  assert.equal(verifyQuote(f).feeRaw,2000000n);
});
test('strict fixed quote below independently calculated cost is rejected',()=>{
  const f=fixture({type:'fixed',amount:2000000,token:NEIRO,strict:true},8000,2000000);
  assert.throws(()=>verifyQuote(f),/cannot cover cost/);
});
test('zero-cost free does not mean paid zero-price data is valid',()=>{
  const f=fixture();f.oracle.tokenPriceSol='0';assert.throws(()=>verifyQuote(f),/positive/);
});
for(const [name,mutate,pattern] of [
  ['overcharge token',f=>f.quote.fee_in_token++,/token amount/],
  ['undercharge token',f=>f.quote.fee_in_token--,/token amount/],
  ['overcharge lamports',f=>f.quote.fee_in_lamports++,/lamports disagree/],
  ['live fee changed',f=>f.config.validation_config.price.margin=0.06,/live price/],
  ['live oracle changed',f=>f.config.validation_config.price_source='Mock',/live oracle/],
  ['wrong signer',f=>f.quote.signer_pubkey='wrong',/quote signer/],
  ['wrong recipient',f=>f.quote.payment_address='wrong',/destination/],
  ['wrong live signer',f=>f.config.fee_payers=[],/live signer/],
  ['wrong listing mint',f=>f.listing.mint='wrong',/listing mint/],
  ['NEIRO not accepted',f=>f.config.validation_config.allowed_spl_paid_tokens=[],/not accepted/],
  ['wrong oracle source',f=>f.oracle.source='Mock',/oracle source/],
  ['151-slot price with explicit 150-slot policy',f=>{f.maxAgeSlots=150;f.currentSlot=1151;},/stale/],
  ['future price',f=>f.oracle.blockId=1151,/future/],
  ['missing price slot',f=>delete f.oracle.blockId,/price slot/],
  ['missing oracle',f=>delete f.oracle,/oracle source/],
  ['negative client freshness',f=>f.maxAgeSlots=-1,/max age/],
  ['fee cap',f=>f.maxFeeRaw=1,/fee cap/],
  ['negative quote',f=>f.quote.fee_in_token=-1,/quoted token/],
  ['unsafe JS amount',f=>f.quote.fee_in_token=Number.MAX_SAFE_INTEGER+1,/quoted token/],
  ['missing paid fee',f=>f.quote.fee_in_token=null,/quoted token/],
  ['missing cost',f=>delete f.costLamports,/transaction cost/],
]) test(`rejects ${name}`,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyQuote(f),pattern);});
for(const [l,r] of [[1,0],[0,1]]) test(`free rejects hidden charges ${l}/${r}`,()=>assert.throws(()=>verifyQuote(fixture({type:'free'},l,r)),/free quote/));
for(const price of [
  {type:'fixed',amount:1,token:'wrong',strict:false},
  {type:'fixed',amount:1,token:NEIRO},
  {type:'fixed',amount:1,token:NEIRO,strict:'false'},
  {type:'fixed',amount:'18446744073709551616',token:NEIRO,strict:false},
  {type:'free',margin:0.1},{type:'percentage',margin:0.1},{type:'margin',margin:-1},
]) test(`rejects malformed price ${JSON.stringify(price)}`,()=>assert.throws(()=>validatePrice(price)));
test('fixed strict change cannot silently differ between config and listing',()=>{
 const f=fixture({type:'fixed',amount:3000000,token:NEIRO,strict:true},12000,3000000);
 f.config.validation_config.price.strict=false;assert.throws(()=>verifyQuote(f),/live price/);
});

for(const policy of [undefined,0]) test(`age cutoff ${policy ?? 'default'} accepts old price while retaining quote checks`,()=>{
 const f=fixture();f.currentSlot=200000;if(policy!==undefined)f.maxAgeSlots=policy;
 assert.equal(verifyQuote(f).feeRaw,2625000n);
 f.quote.fee_in_token++;assert.throws(()=>verifyQuote(f),/token amount/);
});
test('explicit positive freshness policy still accepts its boundary',()=>{
 const f=fixture();f.maxAgeSlots=150;assert.equal(verifyQuote(f).feeRaw,2625000n);
 f.currentSlot++;assert.throws(()=>verifyQuote(f),/stale/);
});
