# Verify the three Kora pricing modes

`verify-quote.mjs` is a small, pure JavaScript quote checker, not a router, complete payment SDK or replacement for Kora. It has no network, signing or third-party dependencies. Node's built-in assertion failures reject a quote.

```sh
node --test tools/kora-publisher/client/*.test.mjs
cargo test --locked --manifest-path tools/kora-publisher/Cargo.toml --test pricing_modes
```

The caller must authenticate and decode the SPL Record, check network/mint/authority/derived address, fetch current configuration and the quote directly, and independently obtain current slot, transaction cost and pricing inputs. Never use the operator's claimed fee as the independent cost. The checker does not perform discovery or validate a transaction's instructions. Before signing, separately validate the exact message, recipients, principal, reimbursement, signer set, program set, blockhash and spending authorization.

## Existing pricing modes

| `price.type` | Independent calculation |
| --- | --- |
| `free` | Zero operator reimbursement; `fee_in_lamports` must be zero and the token fee zero or absent. No oracle is needed to establish zero. |
| `fixed` | Read `amount` (raw token units), `token` (NEIRO mint), and `strict` from the listing. Convert the fixed raw amount to lamports and round down, then convert the quoted lamports back to raw NEIRO and round up, matching the inspected Kora calculation sequence. |
| `margin` | Apply the published margin to the independently derived chargeable lamports and round up; convert to raw NEIRO and round up. |

NEIRO has six decimals. `oracle.tokenPriceSol` is an independently obtained **plain decimal string** in SOL per whole NEIRO, not USD or SOL per raw unit. `oracle.source` must match the listing. Its `blockId` must be the oldest slot of every price used in the conversion (for Jupiter USD conversion, the minimum of SOL and NEIRO price slots). Paid modes reject missing or future price slots. By default `maxAgeSlots = 0` accepts prices without an age cutoff, matching the operator template and accepting stale-price risk. A positive client-chosen limit rejects older prices. This client policy is independent of the operator setting and must not be relaxed by an operator response. `maxFeeRaw` defaults to 5,000,000 raw NEIRO (5 NEIRO); callers must set their own authorized cap. Unsafe JavaScript integers, unsupported fields/models and arithmetic outside u64 bounds are rejected.

`verifyQuote({listing, config, quote, costLamports, oracle, currentSlot, maxAgeSlots, maxFeeRaw})` returns verified `feeRaw` and `feeLamports` as BigInts. `listing` is the already authenticated record JSON; `config` is the `getConfig` result; `quote` is the `estimateTransactionFee` result. Free mode does not require cost/oracle/slot inputs. Fixed non-strict pricing does not require a cost input; strict fixed and margin do. `strict = true` rejects when the fixed lamport value cannot cover independently calculated costs. It does not mean a larger fee can silently be charged.

The helper requires exact agreement with its independently supplied price, with no automatic tolerance. Kora's f64-to-Decimal oracle conversion, price movement between requests, or precision-boundary differences can cause conservative rejection. The caller must reproduce and verify the pinned oracle normalization; passing the operator's own price back to this helper is not independent verification. This is not yet a complete specification/verifier for every Kora-supported transaction shape: rent, priority fees, payer outflow, missing payment instructions and Token-2022 fees require a transaction-aware cost calculation by the caller. The live payment harness has only established the ordinary classic-SPL transfer shape.

## Tests and observed behavior

Client tests cover free/fixed/margin calculations, fixed strictness, rounding, changed configuration, wrong identities/mints, overcharges, fee caps, stale/future/missing price slots and malformed inputs. Rust tests use the actual pinned Kora library with deterministic RPC and mock oracle fixtures; their disabled oracle-age setting exists only because that fixture oracle has no slot. The public operator template and reference client default to no oracle-age cutoff; positive limits remain available.

On 6 October 2026, isolated loopback instances of Mac's unchanged Kora image using mainnet RPC returned a verified free zero-fee quote and rejected a fixed quote for stale oracle data. The existing Mac margin instance rejected stale pricing too. Positive fixed/margin calculations passed deterministic tests; these checks are **not successful mainnet fixed/free transfers or published fixed/free listings**. No transaction was broadcast. Request a free quote without `fee_token` to avoid Kora's otherwise unnecessary token-price lookup for zero.

The isolated free/fixed signing endpoints rejected a one-lamport sponsor withdrawal with `allow_transfer = false`. The pinned library also confirms such a transfer is allowed when that permission is true and other limits permit it. Public Mac/Bunny configurations, including `allow_transfer = true` for the user's DBC flow, were not changed. Temporary instances and credential copies were removed. Upcoming `sponsor_only_programs` protection (#683 / PR #692) restricts untrusted-program access to the sponsor; it does not override explicitly allowed System transfers or make fixed/free pricing reimburse every cost.

## Authenticate RPC-returned listing terms

Use `readRecord(recordAddress, rpcAccount, expectedGenesis, trustedChainContext)` from `read-record.mjs` before passing a listing into `verifyQuote`. The context has exactly the required inputs `{nowUnixSeconds, anchorSlot, anchorBlockhash, anchorBlockTime}`. Obtain the anchor with finalized `getBlock` on the signed `anchor_slot`, and obtain current time from the finalized Solana Clock sysvar on the expected network. The anchor hash must match the signed `anchor_blockhash`. Do not use operator timestamps or host `Date.now()` as a fallback.

The pure reader authenticates the exact v5 schema, operator/derived address, signature, network, NEIRO mint and supported price schema. It rejects missing context, unavailable block time, future anchors, and elapsed time of 172800 seconds or more. Every older version, including persistent v4, is rejected. An expired account may still exist onchain. The clock and block information are trusted inputs; this reader does not perform light-client verification or establish that an RPC supplied the latest account. See the [signed format](../../../docs/SPL-RECORD-LISTINGS.md#operator-attestation-v5).

### Reproduce the live Bunny signature check

With Node.js 20 or later, this standalone check uses only built-in modules and Solana RPC. It includes the reader logic directly; it does not import repository files, fetch GitHub, load keys or install packages. Each RPC must return an anchored v5 listing, its finalized anchor block and finalized Clock data. A closed, unmigrated or expired Bunny listing is expected to fail; historical v4 verification does not establish present eligibility. Replace the public record address to inspect another operator.

```sh
node --input-type=module <<'JS'
// Reference reader: operator attestation bound to exact terms, network and derived record.
import assert from 'node:assert/strict';
import {createHash,createPublicKey,verify} from 'node:crypto';
const NEIRO = 'CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump';
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
function validatePrice(price) {
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

const PROGRAM='recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5';
const MINT='CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump';
const SEED='neiro-kora-fees';
const MAGIC='NEIRO069';
const DOMAIN=Buffer.from('NEIRO069-MSG1\0','ascii');
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function keybytes(text) {
  assert.equal(typeof text,'string','public key');
  assert.ok(text.length>=32 && text.length<=44,'public key length');
  let n=0n; for(const char of text){const digit=ALPHABET.indexOf(char);assert.ok(digit>=0,'base58');n=n*58n+BigInt(digit);}
  let hex=n.toString(16);if(hex.length%2)hex='0'+hex;
  const bytes=Buffer.concat([Buffer.alloc(text.match(/^1*/)[0].length),n?Buffer.from(hex,'hex'):Buffer.alloc(0)]);
  assert.equal(bytes.length,32,'public key bytes');return bytes;
}
function keystring(bytes) {
  bytes=Buffer.from(bytes);assert.equal(bytes.length,32);
  let n=BigInt('0x'+bytes.toString('hex')),s='';while(n){s=ALPHABET[Number(n%58n)]+s;n/=58n;}
  let zeros=0;while(zeros<bytes.length && bytes[zeros]===0)zeros++;
  return '1'.repeat(zeros)+s;
}
function attestationMessage(record,genesis,bodyBytes) {
  return Buffer.concat([DOMAIN,keybytes(record),keybytes(genesis),bodyBytes]);
}
const little=b=>BigInt('0x'+Buffer.from(b).reverse().toString('hex'));
const P=(1n<<255n)-19n,L=(1n<<252n)+27742317777372353535851937790883648493n;
// Small-order y coordinates (both sign bits), also rejected by strict Ed25519.
// See libsodium 1.0.18 ge25519_has_small_order; noncanonical y >= p is rejected too.
const SMALL=new Set([0n,1n,P-1n,2707385501144840649318225287225658788936804267575313519463743609750303402022n,55188659117513257062467267217118295137698188065244968500265048394206261417927n]);
function validPointEncoding(b){const y=little(b)&((1n<<255n)-1n);return y<P&&!SMALL.has(y);}
function verifyAttestation(operator,message,signature) {
  const pub=keybytes(operator),sig=Buffer.from(signature);
  if(sig.length!==64||little(sig.subarray(32))>=L||!validPointEncoding(pub)||!validPointEncoding(sig.subarray(0,32)))return false;
  return verify(null,message,createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),pub]),format:'der',type:'spki'}),sig);
}
function recordAddress(operator) {
  return keystring(createHash('sha256').update(Buffer.concat([
    keybytes(operator),Buffer.from(SEED),keybytes(PROGRAM)
  ])).digest());
}
// Obtain this context independently from trusted finalized chain data on
// expectedGenesis: current UNIX seconds plus the signed slot's block hash/time.
// Never use operator-provided timestamps or treat a missing block as unexpired.
// Legacy persistent records are not accepted by renewal-network discovery.
function readRecord(record,account,expectedGenesis,trustedChainContext) {
  assert.ok(account && account.owner===PROGRAM && account.executable===false,'owner/account');
  assert.equal(account.data?.[1],'base64','encoding');
  const data=Buffer.from(account.data[0],'base64');
  assert.equal(data.length,733,'size');
  assert.equal(data[0],1,'record version');
  const authority=keystring(data.subarray(1,33));
  assert.equal(record,recordAddress(authority),'seeded address');
  assert.equal(data.subarray(33,41).toString(),MAGIC,'format');
  const length=data.readUInt16LE(41),end=43+length;
  assert.ok(length>0 && end+64<=data.length,'signed body length; unsigned listings unsupported');
  assert.ok(data.subarray(end+64).every(b=>b===0),'padding');
  const bytes=data.subarray(43,end),sig=data.subarray(end,end+64);
  assert.ok(verifyAttestation(authority,attestationMessage(record,expectedGenesis,bytes),sig),'invalid operator attestation');
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  assert.equal(body.v,5,'signed schema; anchored v5 required');
  assert.deepEqual(Object.keys(body).sort(),['anchor_blockhash','anchor_slot','genesis','mint','operator','oracle','payment','price','url','v'],'signed fields');
  assert.ok(Number.isSafeInteger(body.anchor_slot) && body.anchor_slot>=0,'anchor_slot integer');
  keybytes(body.anchor_blockhash);
  assert.ok(trustedChainContext && typeof trustedChainContext==='object','trusted finalized chain context required');
  const {nowUnixSeconds,anchorSlot,anchorBlockhash,anchorBlockTime}=trustedChainContext;
  for(const [field,value] of Object.entries({nowUnixSeconds,anchorSlot,anchorBlockTime})) {
    assert.ok(Number.isSafeInteger(value) && value>=0,`trusted ${field} integer required`);
  }
  keybytes(anchorBlockhash);
  assert.equal(body.anchor_slot,anchorSlot,'anchor slot mismatch');
  assert.equal(body.anchor_blockhash,anchorBlockhash,'anchor blockhash mismatch');
  assert.ok(anchorBlockTime<=nowUnixSeconds,'anchor block time in future');
  assert.ok(nowUnixSeconds-anchorBlockTime<172800,'listing expired');
  assert.equal(body.operator,authority,'operator authority');
  assert.equal(body.mint,MINT,'mint');
  assert.equal(body.genesis,expectedGenesis,'network');
  validatePrice(body.price);
  keybytes(body.payment); keybytes(expectedGenesis);
  const url=new URL(body.url);
  assert.ok((url.protocol==='https:' || body.url==='http://127.0.0.1:18080/') &&
    !url.username && !url.password && !url.search && !url.hash,'public URL');
  assert.equal(url.href,body.url,'normalized URL');
  return body;
}

const record='AUcq2QhmqGAH4QSm5qMPnfZb6TcEoKVF8fHGg9FnWKfo';
const genesis='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const clockAddress='SysvarC1ock11111111111111111111111111111111';
for(const rpc of ['https://api.mainnet-beta.solana.com','https://solana-rpc.publicnode.com']) {
  let id=0;
  async function call(method,params=[]) {
    const requestId=++id;
    const response=await fetch(rpc,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),
      signal:AbortSignal.timeout(20000)
    });
    assert.ok(response.ok,'RPC HTTP failure');
    const result=await response.json();
    assert.equal(result.jsonrpc,'2.0');assert.equal(result.id,requestId);
    assert.equal(result.error,undefined,'RPC error');
    return result.result;
  }
  assert.equal(await call('getGenesisHash'),genesis,'RPC network');
  const result=await call('getAccountInfo',[record,{encoding:'base64',commitment:'finalized'}]);
  const account=result?.value;
  assert.ok(account,'listing missing or closed');
  assert.equal(account.data?.[1],'base64');
  const bytes=Buffer.from(account.data[0],'base64');
  assert.equal(bytes.length,733);
  const n=bytes.readUInt16LE(41);assert.ok(n>0 && 43+n+64<=bytes.length);
  // This parse only selects a bounded RPC lookup. Authenticate everything below.
  const candidate=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(43,43+n)));
  assert.equal(candidate.v,5,'anchored v5 required');
  assert.ok(Number.isSafeInteger(candidate.anchor_slot) && candidate.anchor_slot>=0);
  const anchor=await call('getBlock',[candidate.anchor_slot,{
    commitment:'finalized',transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0
  }]);
  assert.ok(anchor,'finalized anchor unavailable');
  const clockResult=await call('getAccountInfo',[clockAddress,{
    encoding:'base64',commitment:'finalized',minContextSlot:candidate.anchor_slot
  }]);
  const clock=clockResult?.value;
  assert.ok(clock,'finalized Clock unavailable');
  assert.equal(clock.owner,'Sysvar1111111111111111111111111111111111111');
  assert.equal(clock.executable,false);assert.equal(clock.data?.[1],'base64');
  const clockBytes=Buffer.from(clock.data[0],'base64');assert.equal(clockBytes.length,40);
  const clockSlot=clockBytes.readBigUInt64LE(0),now=clockBytes.readBigInt64LE(32);
  assert.ok(clockSlot>=BigInt(candidate.anchor_slot),'anchor ahead of finalized Clock');
  assert.ok(now>=0n && now<=BigInt(Number.MAX_SAFE_INTEGER),'Clock timestamp range');
  const trustedChainContext={
    nowUnixSeconds:Number(now),anchorSlot:candidate.anchor_slot,
    anchorBlockhash:anchor.blockhash,anchorBlockTime:anchor.blockTime
  };
  const terms=readRecord(record,account,genesis,trustedChainContext);
  console.log(rpc,'v5 signature and 48-hour anchor validity VERIFIED',terms);
}
JS
```

This only reads public data and sends no transactions. [`getBlock`](https://solana.com/docs/rpc/http/getblock) must supply the matching finalized blockhash and a non-null block time. Errors and missing history fail closed. The Clock account is read after the anchor with a minimum context slot; no local wall clock is substituted. Agreement between two RPCs is useful evidence, not cryptographic proof that either serves current chain state.

The signature begins at `43 + JSON_length`, not at `account_length - 64`. Read the length at bytes 41–42 and verify the stored JSON bytes in the complete domain-separated message. Never reserialize the object for verification. A valid anchor does not prove endpoint availability, current SOL balance or fee honesty; fetch live configuration and independently verify the quote and exact transaction before signing. The operator can subsequently update or close the listing.
