# NEIRO Payment Network Core

Run [Kora](https://github.com/solana-foundation/kora), accept NEIRO for transaction fees, and connect your operator to the NEIRO router. You choose your host and fees and keep control of your wallet.

This repository provides the NEIRO configuration and setup guidance. Kora is the software you run; we do not distribute a separate NEIRO Kora build.

## Run an operator

1. Install and run official Kora using the latest successfully built upstream main revision.
2. Copy our [Kora config](examples/operator/kora.toml) and [signer template](examples/operator/signers.toml) into private storage. Set your fee, wallet and credentials.
3. Validate the config and expose Kora over HTTPS.
4. [Register your URL, host the verification JSON and call verify](docs/REGISTRATION.md).
5. Keep Kora updated. After an upgrade or config change, call verify again and check a routed quote.

[Setup guide](docs/JOIN.md) · [Fees and basics](TUTORIAL.md) · [Configuration details](CONFIGURATION.md)

## Ask an agent to help

```text
Set up a NEIRO operator on [my machine or hosting provider].
Read AGENTS.md and docs/JOIN.md. Run official Kora with the NEIRO config.
Help me choose my fee and spending allowance, supply the required
credentials privately, fund the operator and set up HTTPS.
Register the Kora URL with the Cloudflare router, host its verification
JSON, call verify and confirm eligibility and a routed quote.
Arrange Kora update checks every five minutes. Validate before replacing
it, keep rollback available, and verify with the router after an upgrade.
Keep wallet keys private and do not modify Kora or its SDK.
Leave clear status, update, stop and restart instructions.
```

## What you need

A host that can run Kora, a dedicated operator wallet funded with SOL, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and public HTTPS hosting. Your HTTPS host must also serve the router's verification file. Follow upstream Kora's installation requirements for your chosen host; Docker is optional.

The template recommends a **0.25 SOL per-transaction allowance** and includes an editable **50% markup example**. Choose margin, fixed or free pricing. SOL pays transaction costs; NEIRO reimbursement does not automatically refill SOL. See [fees and operating basics](TUTORIAL.md).

## Clients

Use `https://neiro-cf-router-demo.optical.workers.dev/rpc` as your Kora client endpoint. Choose `?selection=fastest` or `?selection=cheapest`, obtain a payer and quote, approve the fee, and keep the same provider through signing and submission. Clients do not register as operators.

[Client and router documentation](https://github.com/bropump/neiro-kora-router-cloudflare#use-it) · [Operator status](https://neiro-cf-router-demo.optical.workers.dev/operators)

## Configuration and updates

Keep your settings in a private copy of the templates. Operators follow the latest successfully built official Kora main revision and pin each running deployment. Our optional [Docker helpers](docs/DOCKER.md) resolve upstream's image and support validation and rollback; they do not build a NEIRO image. Kora and its SDK remain unchanged.

The current recommendation uses `allowed_programs = "All"`. Read the [configuration notes](CONFIGURATION.md) for its sponsor exposure and the pending upstream protection. [Recorded tests](PLATFORM-TESTS.md) describe what has been checked.
