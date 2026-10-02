<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO Payment Network Core

Run [Kora](https://github.com/solana-foundation/kora), accept NEIRO for transaction fees, and connect your operator to the NEIRO router. You choose your host and fees and keep control of your wallet.

This repository provides the NEIRO configuration and setup guidance. Kora is the software you run; we do not distribute a separate NEIRO Kora build.

## Ask your agent to set it up

Give your coding agent this repository and paste:

```text
Set up and run a NEIRO payment operator on [my machine or hosting provider].
Follow AGENTS.md and docs/AGENT-SETUP.md in this repository.
Use official Kora with the NEIRO configuration. Help me choose fees and
supply missing credentials through private storage. Explain the optional
remote signer; a local dedicated keypair is also supported.
Handle installation, HTTPS, router registration and verification, service
restart and automatic update checks. Verify the running result and leave
simple status, stop, restart and update commands.
Reuse choices and permissions I have already supplied. Ask only for
missing access, decisions or spending approval, never for secrets in chat.
```

Your agent handles **install → configure → start → register → verify → maintain**. You supply host access, private credential references and your operating choices. If you need help choosing them, the agent should guide you through them together.

[Agent instructions](docs/AGENT-SETUP.md) · [Manual setup](docs/JOIN.md) · [Fees and basics](TUTORIAL.md)

## What you need

A host that can run Kora, a dedicated operator wallet funded with SOL, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and public HTTPS hosting. Your HTTPS host must also serve the router's verification file. Follow upstream Kora's installation requirements for your chosen host; Docker is optional.

The template recommends a **0.25 SOL per-transaction allowance** and includes an editable **50% markup example**. Choose margin, fixed or free pricing. SOL pays transaction costs; NEIRO reimbursement does not automatically refill SOL. See [fees and operating basics](TUTORIAL.md).

## Optional remote signing

For stronger key isolation, we recommend a supported remote signer through Kora’s existing **solana-keychain** integration. There is nothing extra to install in Kora. Your agent can configure the chosen backend; the local keypair template remains supported. [Signer choices](docs/SIGNING.md).

## Clients

Use `https://neiro-cf-router-demo.optical.workers.dev/rpc` as your Kora client endpoint. Choose `?selection=fastest` or `?selection=cheapest`, obtain a payer and quote, approve the fee, and keep the same provider through signing and submission. Clients do not register as operators.

[Client and router documentation](https://github.com/bropump/neiro-kora-router-cloudflare#use-it) · [Operator status](https://neiro-cf-router-demo.optical.workers.dev/operators)

## Configuration and updates

Keep your settings in a private copy of the templates. Operators follow the latest successfully built official Kora main revision and pin each running deployment. Our optional [Docker helpers](docs/DOCKER.md) resolve upstream's image and support validation and rollback; they do not build a NEIRO image. Kora and its SDK remain unchanged.

The current recommendation uses `allowed_programs = "All"`. Read the [configuration notes](CONFIGURATION.md) for its sponsor exposure and the pending upstream protection. [Recorded tests](PLATFORM-TESTS.md) describe what has been checked.
