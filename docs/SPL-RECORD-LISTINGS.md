# Publish an operator listing without changing Kora

The optional [Rust publisher](../tools/kora-publisher/) creates, updates and closes one operator-owned SPL Record account. It does not replace or patch official Kora, run a public service, or require a router. A separate client can scan the SPL Record program, authenticate the listings and request quotes from operators directly.

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

## Platforms and security scope

This is a normal Rust executable: build it on the same platform and with the same native build prerequisites as Kora. Cargo builds for the current machine by default; no project-specific installer, platform matrix or cross-compilation script is required. The locked dependencies and pinned toolchain keep the source build reproducible in version selection. Compatibility still follows the upstream libraries and chosen signing backend.

If you specifically need to build for a different machine, Cargo supports `--target TARGET`, with the matching target toolchain, linker and native libraries installed. Cross-compilation is optional; `--target` alone does not supply those prerequisites. The existing mainnet test exercised a macOS-built publisher against Mac and Bunny operators; it did not establish a native build on every operating system.

`address`, `publish` and `close` need no Node.js or Python runtime. Discovery and quote verification remain client-side work; this executable has no discovery command. Listings advertise terms but do not enforce fee honesty. Clients must verify record authority/derived address, pricing inputs, quote and exact transaction before signing. Same-key protection depends on every public signer instance keeping the deny entry active. A single `getConfig` cannot prove every replica is safe. Only compatible raw-message Keychain signer backends have been established; other signer types fail closed rather than bypass signature checks.

See the [security review](../tools/kora-publisher/SECURITY-REVIEW.md). In the 6 October 2026 Mac/Bunny mainnet test, 10 transactions finalized, all record rent and NEIRO returned, and network fees totaled 60,000 lamports. Both listings were closed afterward. Those historical receipts do not certify a newly installed operator or every supported platform.
