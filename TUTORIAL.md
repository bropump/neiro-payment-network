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

Tell your agent which machine or host to use: your Mac, a Raspberry Pi with a suitable 64-bit Linux setup, a server or a cloud container host such as Bunny.net. It must stay online to serve payments.

Have a dedicated operator wallet and funds available. The current network requires at least **$1 of SOL and $1 of NEIRO** in the operator's required accounts. This is an eligibility minimum, not a sufficient operating budget for every workload. Your agent handles the account setup and explains how much additional SOL your chosen spending limit needs.

The agent also guides you through RPC access, the Jupiter pricing key required by the current Kora configuration, and a public HTTPS endpoint. Keep credentials in secret storage, never in the repository or a chat message.

## 2. Ask your AI to set it up

Give your coding agent this repository and paste:

```text
Set up a NEIRO payment operator on [my machine or host].

Read the repository's agent and operator setup instructions.
Get and build the supported official Kora version, or use its official
container image where appropriate. Use the core NEIRO configuration.

Help me choose my fees and per-transaction spending limit.
Guide me through the credentials and wallet funding needed.
Handle the required account setup and keep all keys private.

Validate the configuration, start the operator, register it with the
NEIRO network and check its eligibility and a routed quote.
Test locally first; ask before spending real funds on a payment test.
Tell me exactly what passed and leave start, stop, restart and status
instructions for my host.
```

The agent should follow the [setup guide](docs/JOIN.md) and use the version in the [release file](examples/operator/kora-release.json). Use a private copy of the [NEIRO configuration](examples/operator/kora.toml) for your settings.

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
- **Keep the supplied protections.** Use HTTPS and request limits, and retain Kora's transaction and sponsor permissions. The current Rust router requires public Kora endpoints; API-key-protected providers are not supported by its public profile. Spending limits reduce exposure but do not prevent every loss or software bug.
- **Update deliberately.** We use upstream Kora rather than a custom fork. Follow reviewed release updates, check your configuration and test before returning to service.

The current template uses `allowed_programs = "All"` for broad program compatibility. Arbitrary programs are admitted, and the existing fee-payer policies do not establish a general sponsor-safety boundary. The prepared upstream #683 migration uses a restricted `allowed_programs` list with `sponsor_only_programs = "All"`; it awaits an official release and validation. See [configuration and upgrade status](CONFIGURATION.md).

## What we have tested

| Environment | Completed tests |
| --- | --- |
| Bunny.net | Stock Kora deployment, network registration and quotes; two mainnet Jupiter swaps through the Bunny setup |
| Apple Silicon Mac | Stock Kora configuration checks and two local payments, including a new recipient account |

These payment and swap results predate the current All/0.25 SOL template. The updated template has separate offline configuration checks; every swap or launch and 90% transaction acceptance have not been established. [Read the test results](PLATFORM-TESTS.md).

**Ready to start? Copy the prompt above and tell your agent where to run your operator.**

## Registration and renewal

Use the [Rust registry guide](docs/REGISTRATION.md), not the older HTTP helper. Publication exposes your intended endpoint and payer on Solana and costs a transaction fee. Records expire within 24 hours; arrange renewal before expiry with increasing revisions. The CLI source and agreed network settings must be supplied separately until a release is published. Kora and the gateway remain separate services.
