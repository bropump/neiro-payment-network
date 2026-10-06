# NEIRO Kora listing publisher

A standalone operator-only executable. The running official Kora server and its CLI are unchanged. This package reuses the pinned upstream `kora-lib` configuration/signer builders, Solana Keychain and official SPL Record instruction builders; it exposes no HTTP endpoint and uses no Kora global state. The dependency is substantial even though the custom code is small.

## Build and operate

```
cargo build --release --locked
./target/release/neiro-kora-publisher --operator PUBLIC_KEY address
```

Add the derived address to `[validation].disallowed_accounts` in the existing `kora.toml`, preserving other entries, then restart **every public Kora instance using this signer**. Deny the listing account, not the whole SPL Record program. This leaves unrelated NEIRO ID records usable.

Use the same signer environment and `signers.toml` as your deployment. Credentials never belong on the command line. With multiple configured signers select one by `--signer-name NAME`. This version requires the endpoint's `getPayerSigner` response to select that operator; it fails closed if a pool selects another operator.

```
neiro-kora-publisher --operator PUBLIC_KEY --config kora.toml --signers-config signers.toml publish --url https://operator.example/ --journal create.json
neiro-kora-publisher --operator PUBLIC_KEY --config kora.toml --signers-config signers.toml publish --url https://operator.example/ --journal update.json
neiro-kora-publisher --operator PUBLIC_KEY --config kora.toml --signers-config signers.toml close --journal close.json
```

`publish` creates or updates; identical terms cause no transaction. After changing server terms, restart Kora before republishing. Each send needs a **new journal path**; the signature is saved and synced before submission. On timeout, inspect that signature's status and the account before a new invocation. Do not blindly retry with a different journal. Run one administrator at a time. SDK rebroadcast of the same signed transaction is safe from duplicate execution.

Mainnet genesis is pinned by default. `--rpc-url` or `SOLANA_RPC_URL` selects the RPC; `--genesis` explicitly selects another network. Address derivation needs no signer/config credentials. Closing can work with an offline Kora endpoint or removed deny entry so funds are recoverable; it still needs the local config, correct signer and RPC network.

## Security boundaries

Publication checks the responding Kora's operator, listing deny entry, price/oracle, NEIRO fee acceptance and payment destination. It does **not** prove that every replica uses that config, or that `getConfig` is honest. Test the actual public signing methods for denial. Same-key administration depends on that deny rule staying active on every public service sharing the key.

The command checks record owner/layout/authority, expected signer/network, HTTPS URL without credentials/query/fragment, payload size, 7,000,000-lamport rent cap, 10,000-lamport network fee cap, transaction size and returned signature. Prefunded seeded addresses are recovered atomically before account creation. Closing returns all record lamports to the operator. It creates no token accounts and never transfers tokens.

The signed v4 payload contains only the eight public term fields and a separate Ed25519 signature binding their exact bytes to the record and network. Create/update automatically uses the same fixed format through Keychain; old listings migrate in place, and unchanged valid v4 listings require no signing or transaction. There is no expiry or extra signature metadata. See the [shared format and migration](../../docs/SPL-RECORD-LISTINGS.md#operator-attestation-v4).

Only public advertised terms are stored: endpoint, operator/payment address, NEIRO mint, genesis, pricing and oracle. No expiry or automatic renewal. This is an operator declaration, not enforcement of economic honesty. Clients must authenticate the derived account, authority and detached operator signature, verify quotes independently and inspect the exact transaction before signing. Discovery URL handling, spam limits, RPC trust and price freshness remain client concerns. No audit or general loss-prevention guarantee is implied.

The backend must sign both raw attestation bytes and raw Solana transaction-message bytes through Keychain. Hardware envelope-signing, modifying or sending-only backends are not established compatible; signature verification fails closed. No custom secret parser or key copies are added.

## Verification

`cargo test --locked` runs offline adversarial tests (no mainnet credentials). See [listing setup](../../docs/SPL-RECORD-LISTINGS.md) and `SECURITY-REVIEW.md` for scope and recorded mainnet results. Historical patched CLI work is not required to install this executable.

## Build where Kora runs

This is a normal Rust executable. `cargo build --release --locked` builds for the current machine, using Kora's native build prerequisites and the pinned dependencies. No custom build script, installer, platform build matrix or new Kora distribution is required. Copy `target/release/neiro-kora-publisher` into your executable path if desired.

Cross-compilation is optional: use Cargo's `--target TARGET` with the appropriate target toolchain, linker and native libraries. An executable built for one OS/architecture is not a universal binary. Compatibility follows the upstream dependencies and signing backend; only the recorded macOS mainnet run has been verified so far.

The executable needs neither Python nor Node.js at runtime. `address`, `publish` (create/update) and `close` are provided. Discovery and quote verification remain client-side code, not commands in this executable.
