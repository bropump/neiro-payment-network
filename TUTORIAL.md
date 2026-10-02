# Use AI to run the NEIRO payment network

Run a NEIRO payment operator on your own computer or cloud host. Your operator pays the SOL needed to process a customer's transaction, and the customer reimburses you in NEIRO, including the fee you choose.

You run official **Kora**, Solana's payment sponsorship software, with our **NEIRO configuration**. Your AI agent handles installation and setup.

## Why run one?

Help people use Solana without keeping SOL in their wallets, and charge for providing that service. You choose where to run it and what to charge. You keep control of your operator wallet.

This is a service you operate, not staking or a guaranteed return. You receive fees when customers use your operator. You pay for hosting, RPC access and the SOL your operator spends. Being registered does not guarantee traffic or profit.

## How you get paid

1. An app requests a quote for its customer's transaction.
2. Your operator calculates the cost and your fee in NEIRO.
3. The customer approves the transaction and payment.
4. Kora checks the transaction, adds the operator's signature and submits it. On success, your wallet spends SOL and receives the agreed NEIRO payment in the same transaction.

For example, with a **20% markup**, a transaction whose sponsored cost is worth **10 NEIRO** is quoted at **12 NEIRO**. The extra 2 NEIRO is your gross markup, before running costs and price changes. This is a percentage of the sponsored cost, not the amount the customer sends.

Required token-account creation is part of the supported payment flow. Its sponsored cost is included in cost-based pricing; you do not need to understand or manually configure “ATAs” to get started.

## 1. Choose where to run it

Tell your agent which machine or host to use: your Mac, a server or a cloud container host such as Bunny.net, following upstream Kora requirements. It must stay online to serve payments.

Have a dedicated operator wallet funded with SOL and a NEIRO token account for reimbursement. Keep enough SOL for your intended workload. Your agent can help prepare the accounts; the router does not enforce a dollar-denominated balance minimum.

The agent also guides you through RPC access, the Jupiter pricing key required by the current Kora configuration, and a public HTTPS endpoint. Keep credentials in secret storage, never in the repository or a chat message.

## 2. Ask your AI to set it up

Give your coding agent this repository and the [setup prompt](README.md#ask-your-agent-to-set-it-up). The agent follows our [setup checklist](docs/AGENT-SETUP.md), handles installation and registration, verifies the result and leaves commands for running it.

You choose the host, fee and funding. Supply credentials through private storage. [Remote signing](docs/SIGNING.md) through Kora's solana-keychain integration is an optional recommendation for stronger key isolation; a dedicated local keypair also works.

## 3. Set your fees

You can tell your agent “charge cost plus 20%” or edit the `[validation.price]` section in your private `kora.toml`.

**Cost plus a markup** — recover the calculated sponsored cost and add your fee:

```toml
[validation.price]
type = "margin"
margin = 0.20
```

`0.20` means 20%; `0.50` means 50%; `0.0` means no markup. The included 50% is an editable example, not a network rule.

**A fixed payment** — charge 10 NEIRO and reject transactions whose calculated cost exceeds that payment:

```toml
[validation.price]
type = "fixed"
amount = 10000000
token = "CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump"
strict = true
```

NEIRO has six decimal places, so `10000000` means 10 NEIRO. This is the total operator payment, not an additional markup. More expensive transactions will be rejected.

**Free sponsorship** — cover the cost yourself and receive no reimbursement:

```toml
[validation.price]
type = "free"
```

Use one pricing mode at a time; replace the existing section rather than adding another. After a change, have your agent validate the file, restart Kora and check the new quote.

## 4. Set your spending limit

In the existing `[validation]` section:

```toml
max_allowed_lamports = 250000000
```

The recommendation is **0.25 SOL per transaction**. Choose your own limit. A lower limit rejects more expensive transactions; a higher one permits larger sponsored costs. Quote the complete transaction, including sponsored rent. This allowance does not guarantee every launch will be supported or put a hard cap on every possible loss; Kora models network fees separately from fee-payer outflow. See [configuration details](CONFIGURATION.md).

This is **not a daily budget**. Many transactions can each consume up to the configured allowance. Keep only your intended operating funds in the sponsor wallet and monitor its balance.

## Costs and security

- **Use a dedicated wallet.** Kora needs signing access to it. Do not use your personal savings wallet or commit its private key to Git.
- **SOL goes out; NEIRO comes in.** Reimbursement does not automatically refill your SOL balance. You must manage that balance yourself.
- **Failed transactions can cost money.** If an on-chain transaction fails, network fees can still be charged while its NEIRO payment is rolled back.
- **Keep the supplied protections.** Use HTTPS and request limits, and retain Kora's transaction and sponsor permissions. The Cloudflare router requires public Kora endpoints; API-key-protected providers are not supported by its public profile. Spending limits reduce exposure but do not prevent every loss or software bug.
- **Track official main.** Check for the latest successfully published upstream main image every five minutes. Pin each deployment, validate your private config and retain rollback if an update fails. Main can contain unaudited changes; a successful build is not an audit. We do not patch Kora or the TypeScript SDK.

The current template uses `allowed_programs = "All"` for broad program compatibility. Arbitrary programs are admitted, and the existing fee-payer policies do not establish a general sponsor-safety boundary. The prepared upstream #683 migration uses a restricted `allowed_programs` list with `sponsor_only_programs = "All"`; it awaits a merge into official main and validation. See [configuration and upgrade status](CONFIGURATION.md).

## What we have tested

| Environment | Completed tests |
| --- | --- |
| Bunny.net | Stock Kora deployment, network registration and quotes; two mainnet Jupiter swaps through the Bunny setup |
| Apple Silicon Mac | Stock Kora configuration checks and two local payments, including a new recipient account |

These payment and swap results predate the current All/0.25 SOL template. The updated template has separate offline configuration checks; every swap or launch and 90% transaction acceptance have not been established. [Read the test results](PLATFORM-TESTS.md).

**Ready to start? Give your agent the [setup prompt](README.md#ask-your-agent-to-set-it-up) and tell it where to run your operator.**

## Register and verify

Follow the [registration guide](docs/REGISTRATION.md): submit your Kora URL, serve the returned verification JSON, then call verify. Keep that file available. After upgrading Kora or changing fees, verify again and obtain a new quote. There is no registration transaction or renewal schedule.
