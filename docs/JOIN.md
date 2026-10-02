# Run a NEIRO operator

**Run Kora → configure NEIRO → register your URL → verify.**

## 1. Run Kora

Install [official Kora](https://github.com/solana-foundation/kora) on your chosen machine or host. Use the latest successfully built upstream main revision and record the revision you deploy. Use upstream's installation requirements for that host. [Docker setup](DOCKER.md) is an optional example.

You need a dedicated operator wallet with SOL for sponsorship, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and a public HTTPS endpoint. Keep the host online. We have not published measured CPU/RAM minimums; capacity depends on traffic and RPC performance.

## 2. Apply the NEIRO config

Copy [kora.toml](../examples/operator/kora.toml) and [signers.toml](../examples/operator/signers.toml) to private storage. Set your fee and signer. Load `RPC_URL`, `JUPITER_API_KEY` and, for the example memory signer, `KORA_PRIVATE_KEY` through your host's secret storage. `KORA_PRIVATE_KEY` contains the key material, not a filename.

The config recommends `allowed_programs = "All"` and a **0.25 SOL allowance per transaction**. The **50% margin is an editable example**. [Fees](../TUTORIAL.md#3-set-your-fees) · [Configuration details](../CONFIGURATION.md)

With Kora installed and your private environment loaded:

```sh
kora --config /path/to/kora.toml config validate --signers-config /path/to/signers.toml
kora --config /path/to/kora.toml rpc start --signers-config /path/to/signers.toml
```

Run it under your host's service manager so it restarts when needed. Keep the supplied transaction policies and request limits. The router accesses public Kora endpoints without provider API credentials; do not remove authentication from an existing private service just to join.

## 3. Connect to the router

Expose Kora at your public HTTPS URL. Your HTTPS host must also serve a small verification JSON file on the same hostname. Kora itself does not serve that file automatically.

Follow the [registration commands](REGISTRATION.md): register the URL, host the returned file, call verify, then check `/operators` and a routed quote. Registration uses HTTP and costs no Solana transaction fee. Keep the file available while participating.

## 4. Update and check again

Check for upstream Kora main updates every five minutes. Validate your private config before replacement, preserve your wallet and fees, keep the previous deployment for rollback, and confirm Kora starts successfully. Pin each deployment to its exact upstream revision or image digest. Main can include unaudited changes.

After upgrading or changing config, [call verify again](REGISTRATION.md#after-an-upgrade-or-config-change) using your saved registration ID. Keep the same URL and payer; you do not register again for an ordinary upgrade. The router checks compatibility and health, but currently does not enforce the latest upstream revision.

Monitor SOL liquidity, Kora health and RPC/Jupiter quotas. NEIRO receipts do not automatically replenish SOL. Stop/restart commands depend on your host; the [Docker example](DOCKER.md) includes them.
