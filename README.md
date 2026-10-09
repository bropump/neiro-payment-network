<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO Payment Network (NPN)

## Start here with your agent

- **[Client / builder →](docs/BUILD-WITH-NEIRO.md)** Use NPN or build apps where users pay transaction costs in NEIRO.
- **[Run an operator →](AGENTS.md)** Set up on a Mac, Raspberry Pi, PC or in the cloud and choose your fees.

---

**Pay Solana transaction costs in NEIRO.** Your wallet signs the transaction; an independent Kora operator supplies SOL and receives NEIRO at its advertised price. Transactions settle on Solana.

**[Use NPN](#use-npn-in-five-steps)** · **[Run an operator](#set-up-your-operator)** · **[See what has been tested](docs/FEATURE-MAP.md)**

## Use NPN in five steps

You need a wallet holding NEIRO, a Solana RPC and an app or transaction builder that supports a separate fee payer. Your wallet must be able to sign without sending or changing the transaction. **No NPN SDK, CLI or operator installation is required.**

### 1. Find an operator

Query Solana RPC for `NEIRO069` SPL Records. Verify the operator's signature and listing validity. Each listing gives you its URL and fee terms; read its current SOL balance through RPC. [Discovery query and checks →](docs/SPL-RECORD-LISTINGS.md#discovery-and-client-checks)

### 2. Build what you want to do

Use your existing builder for a payment, swap or other program call. Set the operator as fee payer and keep your wallet as owner and authority. Include operator-funded account setup where needed. [Wallet, app and account funding →](docs/BUILD-WITH-NEIRO.md#use-your-existing-program-or-transaction-builder)

### 3. Get the NEIRO price

Call the operator's `getConfig` and `estimateTransactionFee`. Include the NEIRO reimbursement in the transaction, then re-quote the completed transaction before signing. [Exact HTTP requests →](docs/BUILD-WITH-NEIRO.md#2-build-and-request-quotes)

### 4. Verify and choose

Check the charge against the signed fee terms, independently calculated costs and your NEIRO spending limit. For **fastest**, use the first verified quote; for **cheapest**, compare verified quotes within your deadline. Keep the selected operator through submission. [Fee checks and selection →](docs/BUILD-WITH-NEIRO.md#3-verify-and-select)

### 5. Sign, send and confirm

Simulate the completed transaction and reject errors. Approve it, sign with your wallet and request Kora's signature. Verify the returned message and signatures, send through Solana RPC and confirm the recipient and balance changes. [Simulation, signing and submission →](docs/BUILD-WITH-NEIRO.md#4-approve-and-sign)

**Starting with zero SOL?** Tested paths include NEIRO transfers, account creation and a pump.fun buy. A SOL-priced purchase needs an explicit operator advance or conversion in addition to gas sponsorship. Our pump test included the advance: the buyer started and finished at zero SOL and paid only NEIRO. [Tested paths and limits →](docs/FEATURE-MAP.md)

## Set up your operator

Choose your host, signing wallet and markup. Run **official Kora from latest upstream `main`**, including merged fixes, plus the Node.js listing runner for onchain discovery and renewal. Use the [verified install commands](docs/OPERATOR-SETUP.md#install-kora-and-the-listing-runner); a stable release or old test image is not the installation target.

1. **Install and configure.** Install Kora and Node.js 24+, select your signer and choose your margin, fixed NEIRO fee or free sponsorship.
2. **Fund it.** Add SOL and prepare the NEIRO receiving account.
3. **Protect and start.** Run `protect` to add your listing address to `kora.toml`; load it in every Kora instance sharing the key. Start HTTPS and verify public signing cannot modify the listing.
4. **Publish and renew.** Run one supervised `renew --watch` service with persistent state. It publishes the signed listing and renews it automatically.
5. **Verify it works.** Discover the listing through RPC, complete a payment using your chosen pricing mode, check fees and balances, and verify restart and monitoring.

**[Agent: follow the setup procedure →](AGENTS.md)** · [Detailed installation commands](docs/OPERATOR-SETUP.md) · [RPC setup options](docs/OPERATOR-SETUP.md#free-rpc-options)

Operators supply SOL and choose their own prices. A failed onchain transaction can still cost the operator network fees; reimbursement is not guaranteed on failure.

## Give this to your agent

> Use NPN for this operation. Follow the five payment steps above and their linked checks. Use my existing wallet, pay transaction costs only in NEIRO, verify the quote and final transaction, and return the confirmed signature and actual charge. Do not silently fall back to spending my SOL.

[Client guide](docs/BUILD-WITH-NEIRO.md) · [Operator setup](docs/OPERATOR-SETUP.md) · [Agent setup checklist](AGENTS.md) · [Operations](docs/RENEWAL.md) · [Record format](docs/SPL-RECORD-LISTINGS.md)
