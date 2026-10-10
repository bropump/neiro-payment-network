<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO Payment Network (NPN)

**All of Solana. Gas in NEIRO.**

Send, swap and build on Solana with NEIRO as your gas. NPN connects humans, agents and apps directly with independent operators, powering a peer-to-peer NEIRO economy.

**Unstoppable programmable dog money.**

## Start here with your agent

- **[Client / builder →](docs/BUILD-WITH-NEIRO.md)** Use NPN or build apps where users pay transaction costs in NEIRO.
- **[Run an operator →](#set-up-your-operator)** Five steps for you; your agent handles installation on your computer or in the cloud.
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

**You choose where it runs, which wallet it uses and what you charge. Your agent does the technical setup.** An operator spends SOL to sponsor customers’ transactions and receives NEIRO in return.

1. **Pick a computer or cloud host.** Tell your agent “use this Mac”, “use my Linux server” or “help me choose hosting”. PCs and Raspberry Pis need a supported Kora setup; your agent checks compatibility. The machine must stay online to serve customers.
2. **Choose a dedicated operator wallet.** Ask your agent to create one, or connect your chosen local or remote signer. Keep its recovery access. This is the wallet that spends SOL and receives NEIRO; keep keys out of chat.
3. **Choose your price.** Tell your agent “charge cost plus 20%”, choose a fixed NEIRO payment, or sponsor for free. A 20% markup turns a calculated cost worth 10 NEIRO into a 12 NEIRO quote; it is not 20% of the customer’s transfer.
4. **Set a budget and connect the services.** Specify your SOL funding and hosting budget. Your agent guides you through Solana RPC access (reading/sending transactions), a Jupiter API key (pricing), and an HTTPS address (where clients connect). Let it reuse existing accounts and store credentials privately. Fund only the verified operator address; the operator needs a NEIRO receiving account, not an initial NEIRO deposit.
5. **Give your agent the setup brief below.** It installs current official Kora and the listing runner, protects and publishes your listing, and tests a payment within your limits. Ask it to show the result and how to stop, restart and monitor the service. A separate test customer needs NEIRO for a paid test.

```text
Help me run an NPN operator. Follow the current instructions:
https://raw.githubusercontent.com/bropump/neiro-payment-network/main/AGENTS.md

Host: [my device / cloud provider / help me choose]
Operator wallet or signer: [existing / create a dedicated wallet / help me choose]
Price: [cost plus __% / fixed __ NEIRO / free / explain the options]
Budget: [__ SOL to fund; __ per month for hosting]
Payment test: [customer wallet, amount and maximum NEIRO fee / help me decide]
Existing RPC, Jupiter account and HTTPS address: [what I already have / none]

Walk me through missing decisions one at a time. Explain what each is for.
Handle installation and configuration, keeping keys and credentials private.
Ask before spending beyond my agreed limits. Show evidence of a protected
listing, published terms, a confirmed payment and running renewal/monitoring.
Tell me exactly what is still incomplete.
```

**[Plain-language setup guide →](TUTORIAL.md)** · [Technical procedure for your agent](AGENTS.md)

Keep the host online and replenish its SOL: receiving NEIRO does not automatically refill SOL. Failed onchain transactions can still cost network fees. Hosting, price changes and demand affect returns; a listing does not guarantee customers or profit.

## Give this to your agent

> Use NPN with my existing wallet. Choose a preferred operator by verified price, SOL capacity or response speed, then reuse it. Check its current signed terms and verify each completed quote and transaction before signing. Pay transaction costs only in NEIRO and return the confirmed signature and actual charge. Reconcile uncertain payments before retrying; never silently spend my SOL.

[Client guide](docs/BUILD-WITH-NEIRO.md) · [Operator setup](docs/OPERATOR-SETUP.md) · [Agent setup checklist](AGENTS.md) · [Operations](docs/RENEWAL.md) · [Record format](docs/SPL-RECORD-LISTINGS.md)
