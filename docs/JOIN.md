# Run a NEIRO operator

**Run Kora → configure NEIRO → register your URL → verify.**

Prefer having an agent do this? Use the [setup prompt](../README.md#ask-your-agent-to-set-it-up). This page is the manual reference for you or your agent.

## First: get it working

Start with one operator and one signer. Leave service managers and update schedulers until you have a working routed quote.

### 1. Install Kora

Install [official Kora](https://github.com/solana-foundation/kora) on your chosen machine or host. Use the latest successfully built upstream main revision and record the revision you deploy. Choose the matching [host path](HOSTING.md): native Mac/Linux, Docker, Bunny or another compatible host. Follow that host’s upstream requirements.

You need a dedicated operator wallet with SOL for sponsorship, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and a public HTTPS endpoint. Keep the host online. We have not published measured CPU/RAM minimums; capacity depends on traffic and RPC performance.

The live router uses **Solana mainnet**. Your agent should help you obtain:

- A mainnet RPC URL from your chosen Solana RPC provider; follow that provider's account and quota setup.
- A Jupiter API key from [Jupiter's developer portal](https://portal.jup.ag), entered into private storage.
- A dedicated payer funded with mainnet SOL, plus its NEIRO token account for receiving reimbursement. The router requires no positive NEIRO balance or fixed dollar deposit. Account creation can itself cost SOL; agree the funding scope before doing it.
- An HTTPS hostname whose routing you control. Your agent configures both Kora and the proof-file route.

Use the [funding and fee checklist](FUNDING.md) to distinguish operator SOL liquidity from customer NEIRO payments and check public wallet/account details before funding.

### 2. Put two config files in one private folder

Choose one private folder, such as `~/.config/neiro-operator`, and keep your operator files there. Limit access to your user.

Copy [kora.toml](../examples/operator/kora.toml) and [signers.toml](../examples/operator/signers.toml) to private storage. Set your fee and signer. Load `RPC_URL`, `JUPITER_API_KEY` and, for the example memory signer, `KORA_PRIVATE_KEY` through your host's secret storage. `KORA_PRIVATE_KEY` contains the key material, not a filename.

**Optional:** prefer a supported remote signer through Kora’s existing solana-keychain integration for stronger key isolation. Your agent can configure it; the local keypair template also works. [Signer choices](SIGNING.md).

The config recommends `allowed_programs = "All"` and a **0.25 SOL allowance per transaction**. The signature limit is **10**. The **50% margin is an editable example**. [Fees](../TUTORIAL.md#3-set-your-fees) · [Configuration details](../CONFIGURATION.md)

With Kora installed and your private environment loaded:

```sh
kora --config /path/to/kora.toml config validate --signers-config /path/to/signers.toml
kora --config /path/to/kora.toml rpc start --signers-config /path/to/signers.toml
```

For the first check, run Kora in the foreground and keep the terminal open. Confirm it starts and responds before adding automation. Keep the supplied transaction policies and request limits. The router accesses public Kora endpoints without provider API credentials; do not remove authentication from an existing private service just to join.

### 3. Connect to the router

Follow the [concrete HTTPS/proof example](HTTPS.md), or use your host’s equivalent routing.

Use your host’s HTTPS ingress, or a tunnel/reverse proxy for a local machine. It needs two routes: Kora requests go to the running Kora process; `/.well-known/neiro-router/ID` returns the verification JSON. A tunnel pointed only at Kora is not sufficient to serve the file.

Expose Kora at your public HTTPS URL. Your HTTPS host must also serve a small verification JSON file on the same hostname. Kora itself does not serve that file automatically.

Follow the [registration commands](REGISTRATION.md): register the URL, host the returned file, call verify, then check `/operators` and run the [unsigned quote check](REGISTRATION.md#check-a-routed-quote). Registration uses HTTP and costs no Solana transaction fee. Keep the file available while participating.

**First milestone:** Kora is running, the router reports your operator as eligible, and the unsigned sample quote succeeds through your operator-pinned router URL. This confirms the quote path, not acceptance or settlement of an actual transfer/swap. The agent should also quote your intended transaction before approving any payment.

## Then: keep it running

Once the first milestone passes, install the host’s service manager so Kora and its HTTPS/proof service restart automatically. Confirm a restart preserves the endpoint, payer and proof. Show the user status, logs, stop and restart commands.

Check for upstream Kora main updates every five minutes. Validate your private config before replacement, preserve your wallet and fees, keep the previous deployment for rollback, and confirm Kora starts successfully. Pin each deployment to its exact upstream revision or image digest. Main can include unaudited changes.

After upgrading or changing config, [call verify again](REGISTRATION.md#after-an-upgrade-or-config-change) using your saved registration ID. Keep the same URL and payer; you do not register again for an ordinary upgrade. The router checks compatibility and health, but currently does not enforce the latest upstream revision.

Monitor SOL liquidity, Kora health and RPC/Jupiter quotas. NEIRO receipts do not automatically replenish SOL. Stop/restart commands depend on your host; the [Docker example](DOCKER.md) includes them.
