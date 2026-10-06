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

NEIRO has six decimals. `oracle.tokenPriceSol` is an independently obtained **plain decimal string** in SOL per whole NEIRO, not USD or SOL per raw unit. `oracle.source` must match the listing. Its `blockId` must be the oldest slot of every price used in the conversion (for Jupiter USD conversion, the minimum of SOL and NEIRO price slots). Paid modes reject missing, future or older-than-150-slot prices by default. This check is independent of whether the operator advertises a freshness setting. `maxFeeRaw` defaults to 5,000,000 raw NEIRO (5 NEIRO); callers must set their own authorized cap. Unsafe JavaScript integers, unsupported fields/models and arithmetic outside u64 bounds are rejected.

`verifyQuote({listing, config, quote, costLamports, oracle, currentSlot, maxAgeSlots, maxFeeRaw})` returns verified `feeRaw` and `feeLamports` as BigInts. `listing` is the already authenticated record JSON; `config` is the `getConfig` result; `quote` is the `estimateTransactionFee` result. Free mode does not require cost/oracle/slot inputs. Fixed non-strict pricing does not require a cost input; strict fixed and margin do. `strict = true` rejects when the fixed lamport value cannot cover independently calculated costs. It does not mean a larger fee can silently be charged.

The helper requires exact agreement with its independently supplied price, with no automatic tolerance. Kora's f64-to-Decimal oracle conversion, price movement between requests, or precision-boundary differences can cause conservative rejection. The caller must reproduce and verify the pinned oracle normalization; passing the operator's own price back to this helper is not independent verification. This is not yet a complete specification/verifier for every Kora-supported transaction shape: rent, priority fees, payer outflow, missing payment instructions and Token-2022 fees require a transaction-aware cost calculation by the caller. The live payment harness has only established the ordinary classic-SPL transfer shape.

## Tests and observed behavior

Client tests cover free/fixed/margin calculations, fixed strictness, rounding, changed configuration, wrong identities/mints, overcharges, fee caps, stale/future/missing price slots and malformed inputs. Rust tests use the actual pinned Kora library with deterministic RPC and mock oracle fixtures; their disabled oracle-age setting exists only because that fixture oracle has no slot. Public operators retain the 150-slot guard.

On 6 October 2026, isolated loopback instances of Mac's unchanged Kora image using mainnet RPC returned a verified free zero-fee quote and rejected a fixed quote for stale oracle data. The existing Mac margin instance rejected stale pricing too. Positive fixed/margin calculations passed deterministic tests; these checks are **not successful mainnet fixed/free transfers or published fixed/free listings**. No transaction was broadcast. Request a free quote without `fee_token` to avoid Kora's otherwise unnecessary token-price lookup for zero.

The isolated free/fixed signing endpoints rejected a one-lamport sponsor withdrawal with `allow_transfer = false`. The pinned library also confirms such a transfer is allowed when that permission is true and other limits permit it. Public Mac/Bunny configurations, including `allow_transfer = true` for the user's DBC flow, were not changed. Temporary instances and credential copies were removed. Upcoming `sponsor_only_programs` protection (#683 / PR #692) restricts untrusted-program access to the sponsor; it does not override explicitly allowed System transfers or make fixed/free pricing reimburse every cost.

## Authenticate RPC-returned listing terms

Use `readRecord(recordAddress, rpcAccount, expectedGenesis)` from `read-record.mjs` before accepting the listing passed into `verifyQuote`. This verifies the signed v2 format, operator authority and derived address, exact payload signature, mainnet/mint binding, and supported pricing schema. It has no private key or network dependency and returns the authenticated JSON. The Rust publisher and this Node reader share a public interoperability fixture. Unsigned v1 listings are rejected. Signature authenticity does not prove that an RPC supplied the latest state; see the [signed format specification](../../../docs/SPL-RECORD-LISTINGS.md#operator-attestation-signed-v2).

### Reproduce the live Bunny signature check

From the repository root, with Node.js 20 or later:

```sh
node --input-type=module <<'JS'
import {readRecord} from './tools/kora-publisher/client/read-record.mjs';
const record = 'AUcq2QhmqGAH4QSm5qMPnfZb6TcEoKVF8fHGg9FnWKfo';
const genesis = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
for (const rpc of ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com']) {
  const response = await fetch(rpc, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
      params: [record, {encoding: 'base64', commitment: 'finalized'}]}),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (result.error) throw Error(JSON.stringify(result.error));
  const terms = readRecord(record, result.result.value, genesis);
  if (terms.operator !== 'S42G16e52WiSRuBS49DNSNsWEx1CmysRfmuguEbotyg') throw Error('unexpected operator');
  console.log(rpc, 'operator signature VERIFIED', terms);
}
JS
```

This only reads public data; it loads no keys and sends no transactions. The signature begins at `43 + JSON_length`, not at `account_length - 64`. For the current 331-byte Bunny JSON it occupies bytes 374–437 (zero-based, inclusive), followed by zero padding. Verify the complete domain-separated message specified above, not JSON alone or a reserialized object. The current listing can subsequently be updated or closed by its operator.
