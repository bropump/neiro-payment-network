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

The `memcmp` value is the base58 encoding of the eight ASCII bytes `NEIRO069`. The account has 733 bytes: initialized Record version `1` at byte 0, authority at bytes 1–32, then the marker, a JSON object and zero padding. The JSON fields are `v`, `url`, `operator`, `payment`, `mint`, `genesis`, `price` and `oracle`; `v` is `1`. They advertise public terms, not the full private Kora configuration. The current format has no expiry, namespace-address field or signed latency promise.

Treat scan results as untrusted candidates. Verify program ownership, non-executable status, exact layout, authority equal to the advertised operator, the derived address, mainnet genesis and the expected NEIRO mint. Reject malformed or unsupported fields. Checking only the authority field is insufficient: SPL Record initialization can name another wallet as authority without proving that wallet created or endorsed an arbitrary account. Do not accept arbitrary vanity addresses in this format.

Read live operator SOL balances with `getMultipleAccounts` in supported batch sizes (at most 100 per call), then request live configuration and transaction quotes directly from candidate URLs. Protect against unsafe URLs and DNS destinations, bound response sizes and concurrency, and use deadlines. Verify the payer, payment destination and terms against the record, independently check pricing inputs and rounding, and inspect the exact transaction before signing. A matching config alone does not prove an honest quote.

The current listing does not completely specify the fee calculation: a margin alone does not define the chargeable costs, oracle conversion or rounding. The existing test client supplies those rules for its tested payment shape; this is not a general verifier for every transaction Kora accepts. Before general client interoperability, define a precise, versioned calculation specification with test vectors covering those rules. One calculation shared by a listing-format version needs no additional per-operator field; a profile identifier is useful only if multiple calculations are supported. The current JSON `v = 1` describes the existing format and must not be treated as an already-defined complete fee profile, or silently assigned new semantics for existing listings.

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

The marker replaces the earlier `NKORAF01` marker. Both are eight bytes, so record size (733), marker offset (33), JSON offset (41), address derivation and record authority remain unchanged. Existing operators migrate by using the updated publisher's `publish` command with a fresh signature journal. This writes the new marker without changing their key or deny entry. New clients filter for `NEIRO069` and reject the previous marker; old clients must update to discover migrated listings. No account recreation, additional rent deposit or authority change is required. Nobody can remotely change the marker accepted by an existing client; adopting another format requires changing that client's software or configuration.
