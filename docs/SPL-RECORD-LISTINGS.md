# Publish an operator listing without changing Kora

The [Node.js publisher](../tools/kora-publisher/script/) creates, renews, updates and closes one operator-owned SPL Record account. It does not replace or patch official Kora, run a public service, or require a router. A separate client can scan the SPL Record program, authenticate the listings and request quotes from operators directly.

## Operator setup

Follow the [operator setup steps](../AGENTS.md): install the script, run `protect` on your private Kora config, restart every Kora instance sharing the key, then run one supervised `renew --watch` process. That command handles creation and renewal. `protect` adds the individual listing account to `validation.disallowed_accounts`; it does not restart Kora or block unrelated SPL Records such as NEIRO ID names.

Use [operations](RENEWAL.md) for updates, recovery and closure. The rest of this page specifies the onchain format for client implementers.

## Discovery and client checks

The program already exists on mainnet. Each listing is a separate account; there is no shared master directory account to initialize. The current address is `create_with_seed(operator_public_key, "neiro-kora-fees", Record_program)`. The fixed derivation binds a listing address to its operator and is part of verification, not a cosmetic address choice.

Send this read-only request to a mainnet Solana RPC that supports `getProgramAccounts` for SPL Record:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getProgramAccounts",
  "params": [
    "recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5",
    {
      "encoding": "base64",
      "commitment": "finalized",
      "filters": [
        {
          "dataSize": 733
        },
        {
          "memcmp": {
            "offset": 33,
            "bytes": "E6KkkiG7rCQ"
          }
        }
      ]
    }
  ]
}
```

The `memcmp` value is the base58 encoding of the eight ASCII bytes `NEIRO069`. The signed account has 733 bytes: initialized Record version `1` at byte 0, authority at bytes 1–32, `NEIRO069` at bytes 33–40, a little-endian u16 JSON byte length at bytes 41–42, the exact JSON bytes starting at byte 43, a 64-byte operator Ed25519 signature immediately after the JSON, and zero padding. The JSON contains exactly ten fields: `v`, `operator`, `payment`, `url`, `mint`, `genesis`, `oracle`, `price`, `anchor_slot` and `anchor_blockhash`; `v` is `5`. They advertise public terms and a finalized block anchor, not the private Kora configuration. There is no operator-selected issuance timestamp, expiry, TTL or renewal interval. All operators use the fixed 24-hour renewal and 48-hour validity rules below.

Treat scan results as untrusted candidates. Verify program ownership, non-executable status, exact layout, authority equal to the advertised operator, the derived address, mainnet genesis and the expected NEIRO mint. Verify the separate operator signature before using any terms; the shared [reader](../tools/kora-publisher/client/read-record.mjs) rejects unsigned listings and invalid signatures. Reject malformed or unsupported fields and all legacy versions, including persistent v4. Independently fetch the signed slot with finalized `getBlock`, require the returned hash to match `anchor_blockhash`, and obtain current time from the finalized Solana Clock sysvar. Reject missing block data, future anchors and records whose anchor is at least 172800 chain seconds old. Never substitute the operator's clock, host wall clock or an indefinite legacy fallback. Checking only the authority field is insufficient: SPL Record initialization can name another wallet as authority without proving that wallet created or endorsed an arbitrary account. Do not accept arbitrary vanity addresses in this format.

Read live operator SOL balances with `getMultipleAccounts` in supported batch sizes (at most 100 per call), then request live configuration and transaction quotes directly from candidate URLs. Protect against unsafe URLs and DNS destinations, bound response sizes and concurrency, and use deadlines. Verify the payer, payment destination and terms against the record, independently check pricing inputs and rounding, and inspect the exact transaction before signing. A matching config alone does not prove an honest quote.

The current listing does not completely specify the fee calculation: a margin alone does not define the chargeable costs, oracle conversion or rounding. The existing test client supplies those rules for its tested payment shape; this is not a general verifier for every transaction Kora accepts. Before general client interoperability, define a precise, versioned calculation specification with test vectors covering those rules. One calculation shared by a listing-format version needs no additional per-operator field; a profile identifier is useful only if multiple calculations are supported. The current JSON `v = 5` describes the signed format and must not be treated as an already-defined complete fee profile, or silently assigned new semantics for existing listings.

A [small client quote checker and tests](../tools/kora-publisher/client/README.md) now cover free, fixed NEIRO (including `strict`) and margin modes using independently supplied costs and prices. The publisher already preserves these modes in its `price` JSON. This helper is not a complete transaction-cost calculator; its tests and live limitations are documented alongside it.

Oracle-age policy is separate from listing expiry. The shared Kora template sets `validation.max_price_staleness_slots = 0`, accepting Jupiter pricing without an age cutoff. A positive value makes Kora reject older oracle prices. The live setting is exposed through `getConfig`; it is not currently a signed listing field. Clients can independently enforce their own price-freshness policy. See [pricing configuration and trade-offs](../CONFIGURATION.md#pricing-service).

Choose an operator once by verified price, live SOL capacity, response speed or preference, then reuse it. Later payments can fetch its known record directly instead of scanning all listings. Fully reauthenticate that current record and verify each fresh quote; cached eligibility and an old approval are not sufficient. Reconsider your choice when desired or the operator becomes unavailable, but reconcile any uncertain signed payment before replacing it.

When you choose to compare operators, for fastest response return the first **fully verified** quote without waiting for other tasks. For cheapest, compare verified total costs for the same intended operation among the candidates that respond within the deadline; report that comparison scope. Balance, availability and latency are live observations, not guarantees stored in SPL Record. Unreachable or mismatched operators are skipped. Pin the chosen operator through submission.

RPC scan support and completeness vary. Handle RPC errors explicitly; an incomplete or truncated scan does not establish the complete operator set. Public listings can be spammed even when correctly signed. Production clients need bounded resource use and explicit discovery limits; a fixed test cap is not a protocol limit or a complete anti-spam solution.

## Platforms and security scope

Use the [operator setup steps](../AGENTS.md) to install the publisher. It requires Node.js 24 or newer. Dependencies are pinned in `package-lock.json` and installed with scripts disabled. See the security review for tested platforms and signing backends.

`protect`, `address`, `publish`, `renew`, `check`, `discover` and `close` are provided. `discover` verifies signatures and chain expiry; it does not select the cheapest/fastest quote. Listings advertise terms but do not enforce fee honesty. Clients must verify record authority/derived address, pricing inputs, quote and exact transaction before signing. Same-key protection depends on every public signer instance keeping the deny entry active. A single `getConfig` cannot prove every replica is safe. The runner requires raw-message signatures that verify against the operator. Memory signing has integration evidence; remote adapters have local tests but are not all live-tested. See [signer compatibility and pool limitations](SIGNING.md#listing-runner-compatibility).

See the [security review](../tools/kora-publisher/SECURITY-REVIEW.md). In the 6 October 2026 Mac/Bunny mainnet test, 10 transactions finalized, all record rent and NEIRO returned, and network fees totaled 60,000 lamports. Both listings from that test were closed afterward. A later bounded test may recreate and retain a listing at the same address when explicitly requested; always read current chain state. Those historical receipts do not certify a newly installed operator or every supported platform.

## Namespace and deny-list regression

A focused 6 October 2026 regression used offline Surfpool and the pinned upstream Kora transaction validator. A shared namespace deny entry rejected record creation, but allowed updates and closure of the derived record because those messages did not include the namespace. Denying the individual record or the Record program rejected both mutations. Owner-signed write and close transactions executed successfully in Surfpool; a different authority was rejected.

This is why setup adds each operator's **listing account address** to its Kora deny list. A shared namespace address cannot replace that entry. Blocking the whole Record program would also block Kora sponsorship of unrelated Record operations, including NEIRO ID writes. Read-only RPC discovery is unaffected.

If the operator later changes signing custody while keeping the same public key, its derived listing address stays the same. Rotating to a different public key changes the derived address: protect and verify the new listing before publishing it, and close the old listing using its existing authority when retiring it. Do not remove access to the old authority before its rent and remaining assets have been reconciled.

## Marker ownership and migration

`NEIRO069` is an eight-byte public format identifier, not an account, namespace keypair or registry administrator. Choosing or publishing this identifier grants nobody special rights over another operator's listing. There is no shared setup key to keep or discard. Each operator retains its own record authority for fee/URL updates and closure. The existing SPL Record program's deployment and any upgrade governance are separate; this tool does not deploy or administer that program.

The marker replaces the earlier `NKORAF01` marker. The v5 format keeps the 733-byte account, marker at byte 33, little-endian u16 JSON length at 41, JSON at 43, raw signature immediately after JSON, and zero padding. Address derivation, authority and deny entry stay unchanged. `publish` migrates v1/v2/v3/v4 in place using the existing private state directory and a fresh finalized block anchor. It emits the same payload as a new create; no additional rent, account recreation or authority change is required. Installing a reader does not migrate another operator's account. Every operator must authorize its own migration and install renewal. Strict discovery rejects legacy listings until then; it does not reinterpret v4 signatures as expiring v5 records.

<a id="operator-attestation-signed-v2"></a>
<a id="operator-attestation-neiro069-msg1-v3"></a>

## Operator attestation (v5)

The `v:5` schema fixes Ed25519, the message below, the frame above and the block-anchored renewal policy. There are no `sig_alg`, `sig_enc`, `msg_id`, `signer`, `issued_at` or `expires_at` fields. The operator key is the signing key and must equal the SPL Record authority.

The publisher serializes exactly `v`, `operator`, `payment`, `url`, `mint`, `genesis`, `oracle`, `price`, `anchor_slot` and `anchor_blockhash` as compact JSON with recursively lexicographically sorted object keys. Top-level serialized order is `anchor_blockhash,anchor_slot,genesis,mint,operator,oracle,payment,price,url,v`. The slot is a nonnegative integer and the blockhash is a base58-encoded 32-byte hash. It stores those exact bytes and signs:

```text
ASCII("NEIRO069-MSG1") || 0x00
    || record_pubkey[32] || genesis_hash[32] || exact_terms_JSON_bytes
```

The prefix is 14 bytes including the NUL. Both base58 values are decoded to raw 32-byte values. There is no leading `0xff`, no program ID in the signed message, no preliminary message hash, no wallet prefix and no JWS. Program ownership and the program-derived record address are still checked separately. The signature binds these terms to the record being read and the expected network. Verification uses the stored bytes, never reserialized JSON.

With `n = u16_le(account[41:43])`, terms are `account[43:43+n]` and the 64-byte signature is `account[43+n:43+n+64]` (half-open ranges). Remaining bytes must be zero. Verify against `operator`, after matching it to the authority and derived address, with the actual record address and expected genesis. Never accept an unknown schema or fall back to old signing layouts.

`payment` may intentionally differ from `operator`: it is the fee-receiving wallet chosen in Kora configuration and endorsed by the operator signature. Publication checks it against the responding Kora instance. Quote/transaction verification must match this signed destination, not assume operator equality.

Create and update both use this one signing path through the operator's configured Keychain backend. The operator signs the terms once and then signs the ordinary record-write transaction. Unchanged terms younger than 86400 chain seconds require no signatures or transaction. At or after that threshold, renewal obtains a fresh finalized block anchor and signs an updated attestation and write transaction. Changed terms update immediately. Close only signs its transaction and returns the rent; stop renewal first.

The v5 attestation prefix and frame are unchanged from v4; only the required schema and validity policy change. All older versions are rejected by renewal-network clients, so an operator cannot bypass expiry by downgrading to persistent v4.

The strict reader takes `readRecord(record, account, expectedGenesis, {nowUnixSeconds, anchorSlot, anchorBlockhash, anchorBlockTime})`. The caller must obtain this context independently from trusted finalized RPC data on the expected network. The signed slot/hash must match that block; all numeric context fields must be nonnegative safe integers. Require `anchorBlockTime <= nowUnixSeconds` and `nowUnixSeconds - anchorBlockTime < 172800`. Equality at 48 hours is expired. Missing block history, null block time or unavailable Clock data fail closed. The operator cannot replace the anchor's chain time with its own timestamp. A still-valid older signed record can be replayed within its lifetime by a dishonest RPC; signatures alone do not prove latest state.

The existing SPL Record program still stores bytes and enforces authority; it does not execute this expiry policy or delete expired accounts. The publisher and participating readers apply the fixed rules. RPC trust and finalized chain progress remain explicit dependencies; this is not independent light-client verification. Host timers merely wake the worker, and outages may cause a gap in discovery eligibility. See [renewal operation](RENEWAL.md).

[Read-only verification examples](../tools/kora-publisher/client/README.md#reproduce-the-live-bunny-signature-check) require no private keys. A valid proof plus trusted chain checks establishes the bounded anchor lifetime, but does not establish latest chain state, balances, uptime, discovery completeness or quote honesty. Live configuration and independently verified quotes remain required. The SPL Record program enforces its existing authority rules; every public Kora instance sharing the operator key must continue denying the listing account.
