<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO GAS Network

## Solana transactions. Gas paid in NEIRO.

The NEIRO GAS Network is an open network of payment sponsor operators running [Kora](https://github.com/solana-foundation/kora). Operators pay transaction fees in SOL and receive payment in NEIRO. You choose your fees, host and wallet; the router selects eligible operators by regional response time or estimated fee.

Integrated clients and apps can let users pay transaction fees in NEIRO without maintaining a separate SOL balance for sponsored transactions. Transactions still run and settle on Solana. Users still need the assets they want to transfer or trade, and apps need a compatible Kora payment flow.

Our testing has included x402, MPP, Jupiter swaps, transfers and trades.

Run Kora, accept NEIRO for transaction fees, and connect your operator to the NEIRO router. This repository provides the NEIRO configuration and setup guidance. Kora is the software you run; we do not distribute a separate NEIRO Kora build.

## Ask your agent to set it up

Give your coding agent this repository and paste:

```text
Help me set up and learn to run a NEIRO payment operator.
Follow AGENTS.md and docs/AGENT-SETUP.md in this repository.

Start by asking where I want to run it. If I am unsure, explain the
simple options—my own computer, a server or a cloud host—and help me
choose based on cost, availability and how much maintenance I want.
Explain what I need and guide me through getting anything missing.

Walk me through the setup in plain language. Explain the fee options,
wallet funding and optional remote signer, and help me choose settings.
Use official Kora with the NEIRO configuration. Handle the installation,
HTTPS, router registration and verification wherever you have access.
First get one operator working and show me a routed quote. Then set up
automatic restart and updates. Explain any steps I need to do myself.

Teach me how to check that it is working, view logs, monitor my SOL
balance, change fees, update, stop and restart it. Leave a short guide
with the exact commands for my setup and what their results mean.

Reuse choices and permissions I have already supplied. Ask only for
missing information or required approval. Help me store credentials
privately; never ask me to paste secrets into chat.
```

You do not need to choose a host or understand Kora before starting. Your agent helps you choose, explains each stage and handles the setup where it has access. It then shows you how to operate the service day to day.

[Agent instructions](docs/AGENT-SETUP.md) · [Manual setup](docs/JOIN.md) · [Fees and basics](TUTORIAL.md)

## What you need

Run wherever official Kora runs; Mac, Docker and Bunny are examples, not requirements. Your agent adapts the setup using [upstream deployment guidance](https://solana.com/docs/tools/kora/operators#deployment) and our [host reference](docs/HOSTING.md).

You need a host that can run Kora, a dedicated operator wallet funded with SOL, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and public HTTPS hosting. Your HTTPS host must also serve the router's verification file. Follow upstream Kora's installation requirements for your chosen host; Docker is optional.

The template recommends a **0.25 SOL per-transaction allowance** and includes an editable **50% markup example**. Choose margin, fixed or free pricing. SOL pays transaction costs; NEIRO reimbursement does not automatically refill SOL. See [fees and operating basics](TUTORIAL.md).

## Optional remote signing

For stronger key isolation, we recommend a supported remote signer through Kora’s existing **solana-keychain** integration. There is nothing extra to install in Kora. Your agent can configure the chosen backend; the local keypair template remains supported. [Signer choices](docs/SIGNING.md).

## Clients

Use `https://neiro-cf-router-demo.optical.workers.dev/rpc` as your Kora client endpoint. Choose `?selection=fastest` or `?selection=cheapest`, obtain a payer and quote, approve the fee, and keep the same provider through signing and submission. Clients do not register as operators.

[Client and router documentation](https://github.com/bropump/neiro-kora-router-cloudflare#use-it) · [Operator status](https://neiro-cf-router-demo.optical.workers.dev/operators)

## Configuration and updates

Keep your settings in a private copy of the templates. Operators follow the latest successfully built official Kora main revision and pin each running deployment. Our optional [Docker helpers](docs/DOCKER.md) resolve upstream's image and support validation and rollback; they do not build a NEIRO image. Kora and its SDK remain unchanged.

The current recommendation uses `allowed_programs = "All"`. Read the [configuration notes](CONFIGURATION.md) for its sponsor exposure and the pending upstream protection. [Recorded tests](PLATFORM-TESTS.md) describe what has been checked.
