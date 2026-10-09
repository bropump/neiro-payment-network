<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO Payment Network (NPN)

**All of Solana. Gas in NEIRO.**

Send, swap and build on Solana with NEIRO as your gas. NPN connects humans, agents and apps directly with independent operators, powering a peer-to-peer NEIRO economy.

**Unstoppable programmable dog money.**

## Start here with your agent

- **[Client / builder →](docs/BUILD-WITH-NEIRO.md)** Use NPN or build apps where users pay transaction costs in NEIRO.
- **[Run an operator →](AGENTS.md)** Set up on a Mac, Raspberry Pi, PC or in the cloud and choose your fees.
- **[Client verifications →](Client%20verifications/README.md)** See verified payments, wallets and applications.

---

**[Use NPN](#use-npn-in-five-steps)** · **[Run an operator](#set-up-your-operator)** · **[See what has been tested](docs/FEATURE-MAP.md)**

## Use NPN in five steps

You need a wallet holding NEIRO, a Solana RPC and an app or transaction builder that supports a separate fee payer. Your wallet must be able to sign without sending or changing the transaction. **No NPN SDK, CLI or operator installation is required.**

### 1. Choose your preferred operator

Query Solana RPC for `NEIRO069` SPL Records. Verify the operator's signature and listing validity. Each listing gives you its URL and fee terms; read its current SOL balance through RPC. Choose by available SOL, verified price, response speed or your preference. **Keep using that operator; you do not need to compare everyone again for each payment.** Reconsider whenever you want or it becomes unavailable. [Discovery query and checks →](docs/SPL-RECORD-LISTINGS.md#discovery-and-client-checks)

### 2. Build what you want to do

Use your existing builder for a payment, swap or other program call. Set the operator as fee payer and keep your wallet as owner and authority. Include operator-funded account setup where needed. [Wallet, app and account funding →](docs/BUILD-WITH-NEIRO.md#use-your-existing-program-or-transaction-builder)

### 3. Get the NEIRO price

Call the operator's `getConfig` and `estimateTransactionFee`. Include the NEIRO reimbursement in the transaction, then re-quote the completed transaction before signing. [Exact HTTP requests →](docs/BUILD-WITH-NEIRO.md#2-build-and-request-quotes)

### 4. Verify this payment

Check the operator’s current signed listing, live SOL capacity and configuration. Verify the completed quote against its advertised terms, independently calculated costs and your NEIRO spending limit. **Reuse the operator choice, not an old quote or approval.** [Per-payment checks →](docs/BUILD-WITH-NEIRO.md#3-verify-the-completed-quote)

[Tested examples: account rent, swap protection and safe retries →](docs/CLIENT-PAYMENT-CHECKS.md)

### 5. Sign, send and confirm

Simulate and approve the completed transaction, then sign with your wallet. Save the signed recovery state before sending it to Kora. Ask Kora to **sign** for you to broadcast, or **sign and send**. Verify the exact message, required signatures and settled effects. If a response is lost after signing, reconcile that payment before creating another. [Simulation, signing and submission →](docs/BUILD-WITH-NEIRO.md#4-approve-and-sign)

**Starting with zero SOL?** Tested paths include NEIRO transfers, account creation and a pump.fun buy. A SOL-priced purchase needs an explicit operator advance or conversion in addition to gas sponsorship. Our pump test included the advance: the buyer started and finished at zero SOL and paid only NEIRO. [Tested paths and limits →](docs/FEATURE-MAP.md)

## PayBox for agent payments

**PayBox worked as an agent wallet in a complete NPN payment on a local Surfpool fork.** Its real signing service and official Kora co-signed one transaction: the recipient received **1.25 NEIRO**, the operator received **0.010710 NEIRO** for gas, and the customer stayed at **zero SOL**.

Reusing the existing authorized PayBox wallet was straightforward: load its profile, select the Solana grant and sign the approved NPN transaction through the SDK. First-time onboarding and mainnet settlement were not tested. [Setup path, versions and payment evidence →](docs/test-results/paybox-npn-surfpool-2026-10-09.md)

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

> Use NPN with my existing wallet. Choose a preferred operator by verified price, SOL capacity or response speed, then reuse it. Check its current signed terms and verify each completed quote and transaction before signing. Pay transaction costs only in NEIRO and return the confirmed signature and actual charge. Reconcile uncertain payments before retrying; never silently spend my SOL.

[Client guide](docs/BUILD-WITH-NEIRO.md) · [Operator setup](docs/OPERATOR-SETUP.md) · [Agent setup checklist](AGENTS.md) · [Operations](docs/RENEWAL.md) · [Record format](docs/SPL-RECORD-LISTINGS.md)
