# Publish an operator listing without changing Kora

The [Rust publisher](../tools/kora-publisher/) creates, updates and closes one operator-owned SPL Record account. It does not replace or patch official Kora, run a public service, or require a router. A separate client can scan the SPL Record program, authenticate the listings and request quotes from operators directly.

## Protect the account before publishing

Build the command on the machine where you run Kora, using Rust:

```sh
cd tools/kora-publisher
cargo build --release --locked
./target/release/neiro-kora-publisher --operator YOUR_PUBLIC_KEY address
```

This reads no private key and creates no onchain account. Copy its printed address into the existing `[validation].disallowed_accounts` array in your private `kora.toml`, preserving other entries. Restart every public Kora instance using this signer **before publication**, and check that the running `getConfig` exposes the address and actual signing requests touching it are rejected.

```toml
[validation]
disallowed_accounts = ["YOUR_DERIVED_LISTING_ADDRESS"]
```

The placeholder above must be replaced with the command's actual output. Do not add a second `[validation]` section. The shared config cannot know a new operator's address in advance. Each operator has a different listing, derived from their signer public key, and the same address is reused if they close and recreate it.

The two existing test operators have ready-to-merge snippets:

| Operator | Public signer | Listing to deny |
|---|---|---|
| [Mac](../tools/kora-publisher/examples/mac-listing-guard.toml) | `ANYLfraNjYogERmhLaKfb3Vd183QFZyVb8oLTdU2Xp2N` | `2WrymdQ7uPoaNB65u27DB4bw8NS1eYPS8hfA5K5TS7jQ` |
| [Bunny](../tools/kora-publisher/examples/bunny-listing-guard.toml) | `S42G16e52WiSRuBS49DNSNsWEx1CmysRfmuguEbotyg` | `AUcq2QhmqGAH4QSm5qMPnfZb6TcEoKVF8fHGg9FnWKfo` |

Use those entries only for the corresponding signer. The snippets are public examples, not private deployment snapshots. Publishing them to GitHub does not restart or reconfigure an existing server.

Deny the **listing account**, not the entire SPL Record program. Unrelated records, including NEIRO ID names, remain usable. Listing discovery uses read-only Solana RPC and does not need the listing account inside the payment transaction.

## Create, update and close

Use the same configured signer credentials/environment as your operator deployment; do not put secrets in command arguments. The command reads `kora.toml` and `signers.toml` by default; pass their paths when running elsewhere. `--signer-name` selects a named signer if the file contains more than one.

```sh
neiro-kora-publisher --operator YOUR_PUBLIC_KEY publish --url https://your-operator.example/ --journal create.json
neiro-kora-publisher --operator YOUR_PUBLIC_KEY publish --url https://your-operator.example/ --journal update.json
neiro-kora-publisher --operator YOUR_PUBLIC_KEY close --journal close.json
```

`publish` creates or updates; unchanged terms send nothing. Restart Kora after changing its pricing, then republish. The command checks the responding endpoint's operator, payment address, NEIRO acceptance, pricing and deny entry before loading the signer. A unique signature journal is flushed before each send. On timeout, reconcile that signature before retrying. Close returns the record rent to the operator; network fees are not refundable. No ATAs are created or closed by this tool.

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

The `memcmp` value is the base58 encoding of the eight ASCII bytes `NEIRO069`. The signed account has 733 bytes: initialized Record version `1` at byte 0, authority at bytes 1–32, `NEIRO069` at bytes 33–40, a little-endian u16 JSON byte length at bytes 41–42, the exact JSON bytes starting at byte 43, a 64-byte operator Ed25519 signature immediately after the JSON, and zero padding. The JSON fields are `v`, `url`, `operator`, `payment`, `mint`, `genesis`, `price`, `oracle`, `sig_alg`, `sig_enc`, `msg_id` and `signer`; `v` is `3`. They advertise public terms, not the full private Kora configuration. The current format has no expiry, namespace-address field or signed latency promise.

Treat scan results as untrusted candidates. Verify program ownership, non-executable status, exact layout, authority equal to the advertised operator, the derived address, mainnet genesis and the expected NEIRO mint. Verify the separate operator signature before using any terms; the shared [reader](../tools/kora-publisher/client/read-record.mjs) rejects unsigned listings and invalid signatures. Reject malformed or unsupported fields. Checking only the authority field is insufficient: SPL Record initialization can name another wallet as authority without proving that wallet created or endorsed an arbitrary account. Do not accept arbitrary vanity addresses in this format.

Read live operator SOL balances with `getMultipleAccounts` in supported batch sizes (at most 100 per call), then request live configuration and transaction quotes directly from candidate URLs. Protect against unsafe URLs and DNS destinations, bound response sizes and concurrency, and use deadlines. Verify the payer, payment destination and terms against the record, independently check pricing inputs and rounding, and inspect the exact transaction before signing. A matching config alone does not prove an honest quote.

The current listing does not completely specify the fee calculation: a margin alone does not define the chargeable costs, oracle conversion or rounding. The existing test client supplies those rules for its tested payment shape; this is not a general verifier for every transaction Kora accepts. Before general client interoperability, define a precise, versioned calculation specification with test vectors covering those rules. One calculation shared by a listing-format version needs no additional per-operator field; a profile identifier is useful only if multiple calculations are supported. The current JSON `v = 3` describes the signed format and must not be treated as an already-defined complete fee profile, or silently assigned new semantics for existing listings.

A [small client quote checker and tests](../tools/kora-publisher/client/README.md) now cover free, fixed NEIRO (including `strict`) and margin modes using independently supplied costs and prices. The publisher already preserves these modes in its `price` JSON. This helper is not a complete transaction-cost calculator; its tests and live limitations are documented alongside it.

The oracle-age limit is a separate operator protection. The shared Kora template sets `validation.max_price_staleness_slots = 150`; Kora enforces it and exposes it through `getConfig`. It is not currently a listing field and does not need an onchain update to take effect. Clients can independently enforce their own price-freshness policy. See [pricing configuration](../CONFIGURATION.md#pricing-service).

For fastest response, return the first **fully verified** quote without waiting for other tasks. For cheapest, compare verified total costs for the same intended operation among the candidates that respond within the deadline; report that comparison scope. Balance, availability and latency are live observations, not guarantees stored in SPL Record. Unreachable or mismatched operators are skipped. Pin the chosen operator through submission.

RPC scan support and completeness vary. Handle RPC errors explicitly; an incomplete or truncated scan does not establish the complete operator set. Public listings can be spammed even when correctly signed. Production clients need bounded resource use and explicit discovery limits; a fixed test cap is not a protocol limit or a complete anti-spam solution.

## Platforms and security scope

This is a normal Rust executable: build it on the same platform and with the same native build prerequisites as Kora. Cargo builds for the current machine by default; no project-specific installer, platform matrix or cross-compilation script is required. The locked dependencies and pinned toolchain keep the source build reproducible in version selection. Compatibility still follows the upstream libraries and chosen signing backend.

If you specifically need to build for a different machine, Cargo supports `--target TARGET`, with the matching target toolchain, linker and native libraries installed. Cross-compilation is optional; `--target` alone does not supply those prerequisites. The existing mainnet test exercised a macOS-built publisher against Mac and Bunny operators; it did not establish a native build on every operating system.

`address`, `publish` and `close` need no Node.js or Python runtime. Discovery and quote verification remain client-side work; this executable has no discovery command. Listings advertise terms but do not enforce fee honesty. Clients must verify record authority/derived address, pricing inputs, quote and exact transaction before signing. Same-key protection depends on every public signer instance keeping the deny entry active. A single `getConfig` cannot prove every replica is safe. Only compatible raw-message Keychain signer backends have been established; other signer types fail closed rather than bypass signature checks.

See the [security review](../tools/kora-publisher/SECURITY-REVIEW.md). In the 6 October 2026 Mac/Bunny mainnet test, 10 transactions finalized, all record rent and NEIRO returned, and network fees totaled 60,000 lamports. Both listings from that test were closed afterward. A later bounded test may recreate and retain a listing at the same address when explicitly requested; always read current chain state. Those historical receipts do not certify a newly installed operator or every supported platform.

## Namespace and deny-list regression

A focused 6 October 2026 regression used offline Surfpool and the pinned upstream Kora transaction validator. A shared namespace deny entry rejected record creation, but allowed updates and closure of the derived record because those messages did not include the namespace. Denying the individual record or the Record program rejected both mutations. Owner-signed write and close transactions executed successfully in Surfpool; a different authority was rejected.

This is why setup adds each operator's **listing account address** to its Kora deny list. A shared namespace address cannot replace that entry. Blocking the whole Record program would also block Kora sponsorship of unrelated Record operations, including NEIRO ID writes. Read-only RPC discovery is unaffected.

If the operator later changes signing custody while keeping the same public key, its derived listing address stays the same. Rotating to a different public key changes the derived address: protect and verify the new listing before publishing it, and close the old listing using its existing authority when retiring it. Do not remove access to the old authority before its rent and remaining assets have been reconciled.

## Marker ownership and migration

`NEIRO069` is an eight-byte public format identifier, not an account, namespace keypair or registry administrator. Choosing or publishing this identifier grants nobody special rights over another operator's listing. There is no shared setup key to keep or discard. Each operator retains its own record authority for fee/URL updates and closure. The existing SPL Record program's deployment and any upgrade governance are separate; this tool does not deploy or administer that program.

The marker replaces the earlier `NKORAF01` marker. Both markers are eight bytes. The current v3 format keeps the signed v2 frame (733 bytes, marker at 33, JSON length at 41, JSON at 43, raw signature immediately after JSON), derived address and authority. It adds explicit verification metadata to the JSON and uses `NEIRO069-MSG1`. Existing operators migrate in place with the updated publisher's `publish` command and a fresh signature journal. No account recreation, additional rent or deny-list change is needed. The reference reader accepts only v3; there is no silent fallback to unsigned v1 or the previous v2 message. Nobody can remotely change which format an existing reader accepts.

<a id="operator-attestation-signed-v2"></a>

## Operator attestation (NEIRO069-MSG1, v3)

Every operator publishes these exact metadata values inside the signed JSON:

```json
{
  "v": 3,
  "sig_alg": "ed25519",
  "sig_enc": "raw64-after-json",
  "msg_id": "NEIRO069-MSG1",
  "signer": "OPERATOR_PUBLIC_KEY"
}
```

`v` versions the whole listing schema; `msg_id` identifies only the signing layout. They are separate identifiers with a fixed supported mapping: v3 requires `NEIRO069-MSG1`. A future mapping must be explicitly specified and supported; unknown IDs are rejected.

`signer` must equal `operator` and the SPL Record authority. `payment` may intentionally differ: it is the fee-receiving wallet chosen in Kora configuration and explicitly endorsed by the operator signature. The publisher checks it against the responding Kora instance before publication. Readers must match the quote and actual transaction fee destination to this signed `payment`, rather than assume it equals `signer`. `sig` is the 64 raw bytes immediately after the length-delimited JSON, not a JSON property or the final 64 bytes of the padded account. With `n = u16_le(account[41:43])`, take the exact JSON bytes `account[43:43+n]` and `sig = account[43+n:43+n+64]` (half-open ranges). The rest must be zero padding. The metadata itself is covered by the signature. Reject unknown versions, algorithms, encodings and message IDs, including correctly signed per-operator variations. Do not execute or dynamically load code named by an untrusted record.

`NEIRO069-MSG1` has exactly one definition, shared by all v3 operators. Sign Ed25519 directly over:

```text
0xff || ASCII("NEIRO069-MSG1") || 0x00
     || program_pubkey[32] || record_pubkey[32] || genesis_hash[32]
     || exact_JSON_bytes
```

The program is the SPL Record program, the record address is the account being read, and genesis is the expected network genesis. Decode these three base58 strings into raw 32-byte values, not UTF-8 strings. Do not hash the message first, reserialize the JSON or add a wallet message prefix. This is exact-byte signing, not canonical-JSON signing: key order and whitespace are already fixed in the stored bytes everyone reads. Parsing and serializing the same fields can produce different bytes and must never be used to reconstruct this signature message. Record/network binding prevents moving the same proof to another account or network. The domain's first byte is not a supported Solana transaction-message version, separating the proof from normal public transaction-signing requests.

The onchain ID tells agents which defined format to use; it does not replace the format specification. A reader must know this fixed definition or reject the listing. The [read-only reproduction command](../tools/kora-publisher/client/README.md#reproduce-the-live-bunny-signature-check) and public Rust-produced fixture provide executable interoperability checks. Historical v2 used `0xff || ASCII("NEIRO069:listing:v2") || 0x00` with the same bindings and no verification metadata; that definition has not been changed.

The operator signs once when creating or changing the listing, then signs the ordinary write transaction. Identical terms with a valid existing proof require neither signature nor an onchain transaction. Closing requires only the normal transaction signature. No expiry, heartbeat, central authority or periodic signing is introduced. The existing allocation holds both signatures' relevant data without additional rent: the transaction signature is in the transaction; the detached attestation is in the record.

A client reading via any RPC or router verifies the stored signature with the advertised operator key, after binding that key to the record authority and derived address. Fabricating a fee, URL or payment address invalidates that proof. RPC-reported balances, liveness and other account metadata are not covered by it. A valid old proof can still be replayed: the attestation does not establish current chain state, completeness of discovery, freshness or economic honesty. Current-state assurance still needs appropriate chain/RPC verification.

The previous plain-JSON v1 and signed v2 forms are rejected by the v3 reader; there is no format fallback. Existing operators use `publish` once to update in place, using a fresh journal path. Readers of the old byte layout must adopt the v3 reader/specification. The SPL Record program itself still enforces its normal authority rules, rather than interpreting this application's signature format. Continue denying the listing account on every public Kora instance sharing its key.
