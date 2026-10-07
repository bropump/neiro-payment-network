# Run Kora and publish your operator

Give your agent the [setup prompt](../README.md#ask-your-agent-to-set-it-up), or follow the [complete setup workflow](AGENT-SETUP.md). The operator uses official Kora and a separate Rust executable for listing administration.

1. Build or install [official Kora](https://solana.com/docs/tools/kora/operators) on your chosen host. Pin the running revision. Build the publisher with `cargo build --release --locked` from `tools/kora-publisher`.
2. Keep private copies of [kora.toml](../examples/operator/kora.toml) and [signers.toml](../examples/operator/signers.toml). Choose the operator's fees, spending policies and local or [remote signer](SIGNING.md). Supply Solana mainnet `RPC_URL` and Jupiter credentials privately.
3. Fund the operator's SOL sponsorship balance and listing rent; prepare its NEIRO fee-receipt account. There is no fixed token deposit imposed by the listing. NEIRO revenue does not automatically refill SOL.
4. Derive the listing with `neiro-kora-publisher --operator OPERATOR_PUBLIC_KEY address`. Add that address to the existing `[validation].disallowed_accounts` in every public instance sharing the key, preserving other entries.
5. Validate and start Kora with your private files:

   ```sh
   kora --config /path/to/kora.toml config validate --signers-config /path/to/signers.toml
   kora --config /path/to/kora.toml rpc start --signers-config /path/to/signers.toml
   ```

6. Expose a stable [HTTPS endpoint](HTTPS.md). Verify `getConfig`, `getPayerSigner`, the loaded deny rule and actual signing rejection for the listing account.
7. [Publish the SPL Record](REGISTRATION.md), confirm finality, then verify independent discovery and direct quotes. No router or hosted verification file is required.
8. Install the [required renewal worker](RENEWAL.md) with an hourly native timer and private persistent state. It renews after 24 chain hours; clients reject the listing after 48 hours without a fresh finalized block anchor.

Kora's `RPC_URL` must be a Solana RPC endpoint. Keep signer credentials out of public requests and listings. Retain transaction policies and request limits.

Use the host's normal service tools for restart, monitoring and upgrades. Preserve the signer and deny entry, validate before replacing a build and retain a rollback version. Republish after changing advertised terms. Leave exact status, log, restart and balance-check commands in the private operating notes.
