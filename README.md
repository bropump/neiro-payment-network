<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO Payment Network Core

NEIRO Payment Network lets humans and agents use Solana with transaction fees paid in NEIRO. Independent operators cover the SOL and required token-account setup, so customers can transfer, swap and use supported apps without maintaining a separate SOL balance. Transactions run and settle directly on Solana L1.

This repository contains the core NEIRO configuration and instructions for running an operator with [Kora](https://github.com/solana-foundation/kora). Operators choose their own hosting, control their own wallets and set their own fees. Running one helps distribute payment sponsorship across more people and places, and earns NEIRO from the transactions it serves. Operators publish signed registrations on Solana. Independently hosted Rust routers read that registry and help apps find eligible operators.

## Getting started

You can run an operator on your own machine, a Linux server or a cloud container host. Give your coding agent this repository and the prompt below. It will guide you through installation, help you choose your fees and connect your operator to the network.

```text
Set up a NEIRO payment operator on [my machine or hosting provider].

Read AGENTS.md, docs/AGENT-SETUP.md and docs/JOIN.md. Get and build the
supported official Kora release in examples/operator/kora-release.json,
or use its official container image. Use examples/operator/kora.toml
and the signer template as the starting configuration.

Help me choose my fee: cost plus a percentage, a fixed NEIRO amount,
or free sponsorship. Explain the options and help me set the maximum
SOL I want to cover per transaction.

Install the software and prepare the required accounts. Guide me through
any missing credentials, wallet funding and HTTPS setup. Keep secrets
out of chat and Git. Read docs/REGISTRATION.md. Confirm the registry network settings and
router address from the maintainer rather than guessing them.

Validate the configuration and start Kora. Obtain the reviewed Rust CLI
and publish the on-chain registration within my approved spending scope.
Arrange renewal before expiry with increasing revisions. Explain that
my endpoint and payer become public. Check eligibility and obtain a routed
quote showing my configured fee. Test payments on a private ledger
unless I approve spending real funds.

Tell me what passed, what still needs my input, and how to check,
stop and restart the operator or change its fees.
```

You will need access to your host, a dedicated operator wallet and funding, Solana RPC access, a Jupiter key for pricing, and a public HTTPS endpoint. Your agent can help configure these. For a step-by-step explanation, read the [operator tutorial](TUTORIAL.md); for commands, follow the [manual setup guide](docs/JOIN.md).

## Fees

Operators spend SOL and receive NEIRO. You can charge the calculated sponsored cost plus a percentage, set a fixed NEIRO payment, or sponsor transactions for free. With a 20% markup, a transaction costing the equivalent of 10 NEIRO is quoted at 12 NEIRO. The percentage applies to the cost you cover, not the amount the customer sends.

Tell your agent which pricing model you want, or edit the `[validation.price]` section in your private copy of `kora.toml`. To charge cost plus 20%, use:

```toml
[validation.price]
type = "margin"
margin = 0.20
```

Validate the file and restart Kora after changing it. The tutorial includes [fixed and free pricing examples](TUTORIAL.md#3-set-your-fees).

Your spending limit is separate from your fee. The recommended template uses a 0.25 SOL per-transaction allowance and an editable 50% markup example; operators choose their own allowance and fee. See [setting your spending limit](TUTORIAL.md#4-set-your-spending-limit).

## Using the network

An integrated app requests a quote, the customer approves the transaction and NEIRO fee, and an operator sponsors its submission to Solana. When the transaction succeeds, the operator receives the agreed NEIRO payment.

An agent can use the same flow to request a price, check it against its owner's budget and inspect the payment receipt. Permissions and budgets belong in the agent's wallet or application. People and agents both benefit from paying fees in the currency they already hold.

The network uses Solana's programs and benefits from its upgrades. Solana's upcoming Alpenglow upgrade targets roughly 150ms finality. See the [Alpenglow overview](https://solana.com/upgrades/alpenglow) for its progress.

## Operating and security

Use a dedicated wallet, protect its key and keep HTTPS, request limits and Kora's permissions enabled. This Rust router uses public Kora endpoints without provider API keys; all signing and reimbursement checks must hold at Kora itself. Keep the service online, renew its on-chain registration before expiry and monitor its SOL balance. NEIRO reimbursement does not automatically replenish SOL, and earnings need to cover hosting and other running costs.

The spending limit applies per transaction, not per day. Failed on-chain transactions can still cost SOL without reimbursing you. Read the [security and operating guidance](TUTORIAL.md#costs-and-security) before funding an operator.

## Testing and updates

We have deployed stock Kora on Bunny.net, registered an operator and completed two mainnet Jupiter swaps through the earlier Bunny router setup. Those tests predate the Rust on-chain registration workflow documented here. On an Apple Silicon Mac, configuration validation and local payment tests passed, including payment to a new recipient account. The [test record](PLATFORM-TESTS.md) describes the configurations and results.

The [release file](examples/operator/kora-release.json) pins the supported Kora version. The current template uses `allowed_programs = "All"` for broad program compatibility. This admits arbitrary program IDs and leaves sponsor exposure described in upstream #683; it does not establish measured 90% transaction acceptance or arbitrary-program safety. The prepared migration to `sponsor_only_programs = "All"` with restricted sponsor participation awaits an official upstream release and compatibility checks. See the [configuration and upgrade notes](CONFIGURATION.md).

Registration uses a separate CLI on the operator host. You do not need to host a router to run Kora. [Registration and renewal](docs/REGISTRATION.md) · [Run a router separately](docs/ROUTER.md)
