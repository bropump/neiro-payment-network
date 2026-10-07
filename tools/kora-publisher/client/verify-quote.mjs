// Pure quote checker. Caller authenticates the record and independently derives
// transaction cost and oracle inputs; no keys, networking or signing occur here.
import assert from 'node:assert/strict';
export const NEIRO = 'CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump';
const U64 = (1n << 64n) - 1n;
function uint(value, label) {
  assert.ok(typeof value === 'bigint' || (typeof value === 'number' && Number.isSafeInteger(value)) ||
    (typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value)), label);
  const n = BigInt(value); assert.ok(n >= 0n && n <= U64, label); return n;
}
function decimal(value) {
  const s = String(value);
  assert.match(s, /^(0|[1-9][0-9]{0,9})(\.[0-9]{1,28})?$/, 'plain nonnegative decimal required');
  const [whole, fraction=''] = s.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
const ceil = (n,d) => (n+d-1n)/d;
export function validatePrice(price) {
  const fields = {free:['type'], fixed:['amount','strict','token','type'], margin:['margin','type']}[price?.type];
  assert.ok(fields, 'unsupported price model');
  assert.deepEqual(Object.keys(price).sort(),fields,'unexpected price fields');
  if (price.type === 'fixed') {
    uint(price.amount,'fixed amount'); assert.equal(price.token,NEIRO,'fixed mint');
    assert.equal(typeof price.strict,'boolean','fixed strict');
  }
  if (price.type === 'margin') decimal(price.margin);
  return price;
}
export function verifyQuote({listing,config,quote,costLamports,oracle,currentSlot,maxAgeSlots=0,maxFeeRaw=5_000_000}) {
  const price=validatePrice(listing.price);
  assert.equal(listing.mint,NEIRO,'listing mint');
  assert.equal(quote.signer_pubkey,listing.operator,'quote signer');
  assert.equal(quote.payment_address,listing.payment,'quote payment destination');
  assert.ok(config.fee_payers.includes(listing.operator),'live signer');
  assert.deepEqual(config.validation_config.price,price,'live price differs from listing');
  assert.equal(config.validation_config.price_source,listing.oracle,'live oracle differs from listing');
  const quotedLamports=uint(quote.fee_in_lamports,'quoted lamports');
  const quotedRaw=quote.fee_in_token == null && price.type === 'free' ? 0n : uint(quote.fee_in_token,'quoted token fee');
  assert.ok(quotedRaw <= uint(maxFeeRaw,'client fee cap'),'client fee cap exceeded');
  if (price.type === 'free') {
    assert.equal(quotedLamports,0n,'free quote charges SOL');
    assert.equal(quotedRaw,0n,'free quote charges NEIRO');
    return {mode:'free',feeRaw:0n,feeLamports:0n};
  }
  assert.ok(config.validation_config.allowed_spl_paid_tokens === 'All' ||
    config.validation_config.allowed_spl_paid_tokens?.includes(NEIRO),'NEIRO not accepted');
  assert.equal(oracle?.source,listing.oracle,'independent oracle source');
  const slot=uint(currentSlot,'current slot'), priceSlot=uint(oracle.blockId,'price slot');
  // Client policy: 0 accepts oracle age, matching the operator template.
  // Never inherit this decision from an untrusted operator response.
  const maxAge=uint(maxAgeSlots,'max age');
  assert.ok(priceSlot<=slot,'future price');
  assert.ok(maxAge===0n || slot-priceSlot<=maxAge,'stale price');
  // NEIRO has six decimals: lamports per raw unit = SOL/token * 10^9 / 10^6.
  const [p,d]=decimal(oracle.tokenPriceSol); assert.ok(p>0n,'positive token price required');
  const n=p*1000n;
  let lamports;
  if (price.type === 'fixed') {
    lamports=uint(price.amount,'fixed amount')*n/d; // Kora floors token -> lamports.
    if (price.strict) assert.ok(lamports>=uint(costLamports,'independent transaction cost'),'strict fixed fee cannot cover cost');
  } else {
    const cost=uint(costLamports,'independent transaction cost'), [m,md]=decimal(price.margin);
    lamports=ceil(cost*(md+m),md);
  }
  uint(lamports,'calculated fee overflow');
  const raw=ceil(lamports*d,n); // Kora ceils lamports -> token base units.
  uint(raw,'calculated token overflow');
  assert.equal(quotedLamports,lamports,'quote lamports disagree with listed price');
  assert.equal(quotedRaw,raw,'quote token amount disagrees with independent calculation');
  return {mode:price.type,feeRaw:raw,feeLamports:lamports};
}
