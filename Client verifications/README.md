# Client verifications

Verified operations include **Jupiter swaps, MiniRouter deposit swaps, PaySponge and pay.sh signing**, transfers, naming, token launches, trading and staking. Results below distinguish mainnet payments, Surfpool program execution and wallet-signing support.

## Swaps and payments

| Application or flow | Result / environment | What was verified |
|---|---|---|
| Jupiter — NEIRO ↔ USDC | **Works — mainnet** | Two finalized swaps through Bunny Kora: 10 NEIRO → 0.005067 USDC → 9.941756 NEIRO. NEIRO reimbursement included account-creation costs and 5% markup. [Evidence](../docs/test-results/swaps-and-wallets.md#jupiter). |
| Jupiter — NEIRO → USDC | **Works — Surfpool** | Live Jupiter instructions using a Raydium route executed on a fork; 1,000 NEIRO → 0.512701 USDC, with customer SOL remaining zero. Historical price-source override used. [Scope](../docs/test-results/swaps-and-wallets.md#jupiter). |
| MiniRouter — NEIRO → USDC deposit swap | **Works — Surfpool** | Adapted MiniRouter orders settled both directly through Kora and through the then-current router. Router run delivered 0.553293 USDC to the destination; customer held zero SOL. Real MiniRouter account credit was not tested. [Evidence and required adaptation](../docs/test-results/swaps-and-wallets.md#minirouter). |
| USDC transfer, paid in NEIRO | **Works — Surfpool** | Operator funded a new recipient ATA and gas; customer sent USDC and reimbursed in NEIRO while holding zero SOL. [Evidence](../docs/test-results/swaps-and-wallets.md#other-earlier-program-checks). |
| NEIRO transfer, new or existing recipient ATA | **Works — Surfpool** | Operator-funded account creation where needed; exact reimbursement and zero customer SOL checked. [Results](../docs/test-results/client-practices-surfpool-2026-10-07.md). |
| NEIRO ID registration, resolution and tipping | **Works — Surfpool** | pay.sh signed registration and two tips, including a new recipient ATA; operator funded rent and gas. Customer stayed at zero SOL. [Results](../docs/test-results/swaps-and-wallets.md#paysh). |
| Pump bonding-curve buy | **Works — Surfpool** | Buyer started and finished at zero SOL. Operator advanced purchase SOL and funded account setup; buyer paid NEIRO and retained the tokens. [Results](../docs/test-results/pump-buy-surfpool-2026-10-08.md). |

## Wallet signing

| Wallet / signer | Result | Exact supported path tested |
|---|---|---|
| PaySponge | **Works — real wallet API signing, Surfpool execution** | Sign-only API preserved the other signature while creating a classic SPL mint, creating its ATA and minting 123 tokens. Customer held zero SOL. [API, versions and evidence](../docs/test-results/agent-uptake-2026-10-07.md#paysponge-reproducibility). |
| pay.sh | **Works — local wallet signing, Surfpool execution** | Local file-keystore signer plus Kora completed NEIRO ID registration, tipping and a Pump `createV2` launch. This was outside stock solOS. [Evidence](../docs/test-results/swaps-and-wallets.md#paysh). |
| Local Solana Ed25519 keys | **Works — mainnet and Surfpool** | Used in the swap and program tests on this page, preserving the approved transaction message and collecting customer/operator signatures. |

These results cover the signing paths actually exercised. Privy, Turnkey, Para and browser-wallet integrations still need their own provider tests; local-key fallback does not prove a hosted signer.

Jupiter and MiniRouter swap results include earlier router-based integrations. They establish the sponsored operations tested; current signed-listing discovery is a separate check.

## Applications — verified on Surfpool

The flows below completed using an actual official Kora operator connected to a local Surfpool fork. Customer wallets started with NEIRO only and remained at **0 SOL**. The operator supplied SOL and received the customer's NEIRO payment.

| Application | Result | What was tested |
|---|---|---|
| Stonkfun | Works | Created a Token-2022 LaunchLab curve using Stonkfun's platform, allow-config and curve-rule accounts. Verified the creator, platform and token supply. |
| Ember | Works | Created a Meteora DBC pool using Ember's reusable config and launch memo. Verified the creator and config. |
| Hooked — P2P-only | Works | Created a Token-2022 DBC pool and initialized the actual P2P hook. Verified the hook rule account, creator and mint linkage. |
| Phoenix — DOGE perps | Works | Registered a trader, deposited operator-funded collateral directly into the trader account, bought 100 DOGE and sold all 100. Verified the final DOGE position was zero. |
| Bangfun | Works — gas sponsorship | Launches with 1 billion and 500 million supply; curve buys/sells and creator claims; 1 billion curve graduation; graduated DAMM buy/sell and creator claim. Verified finalized state across 25 transactions. Current website requires NPN integration changes. |
| Pump | Works | Launched a regular SOL-paired Token-2022 coin with `create_v2`. Operator paid fees and account rent; customer remained the recorded creator. Verified curve, 1 billion supply and revoked mint/freeze authority. No initial buy. |
| Meteora DBC | Works | Created a new DBC configuration and launched its classic SPL curve. Operator paid fees and account rent; verified customer creator, fee recipient, config, 1 billion supply and revoked mint/freeze authority. No initial buy. |
| Raydium LaunchLab | Works | Launched a Token-2022 curve using Raydium’s default platform/config. Operator paid fees and account rent; verified customer creator, platform, config, 1 billion supply and revoked mint/freeze authority. No initial buy. |
| Marinade | Works — gas sponsorship | Deposited 0.1 SOL through the liquid-staking program and received 0.070873849 mSOL. Operator funded principal, mSOL account rent and gas; customer paid NEIRO and started/finished at 0 SOL. Separate listing-verification failure described below. |

<details>
<summary>Verification details and integration requirements</summary>

## How NPN paid for the app checks

1. Published and authenticated a local NPN operator listing, then checked its live Kora config.
2. Built the application instructions with the operator as fee payer and the customer as owner or creator. Included the NEIRO reimbursement in the transaction.
3. Simulated the completed transaction, requested Kora's quote and checked the charge against the signed terms and independently calculated cost.
4. Collected the customer and Kora signatures, verifying that the transaction message stayed unchanged.
5. Submitted to Surfpool and checked finalized success, application state, exact NEIRO transfers and the customer's zero SOL balance.

Kora's listing-account protection and priority-fee cap were also checked.

Marinade was a separate trial: listing protection was checked, but priority-cap probes were not repeated. Its payment passed while final listing authentication failed, as detailed below; the full sequence above must not be inferred from its gas-sponsorship PASS.

## Marinade — verification details

A fresh GPT-6.1 Sol agent on low reasoning randomly selected Marinade from four established products. It used the official Marinade SDK **6.1.0** to build a 0.1 SOL deposit, changed the new mSOL ATA's payer to the operator, and added an explicit operator-to-customer principal advance. The customer retained ownership of the received mSOL. This advance is additional to gas sponsorship and was fully included in NEIRO reimbursement.

The finalized transaction delivered **0.070873849 mSOL**. Operator costs were **0.1 SOL principal + 0.002039280 SOL rent + 0.000010000 SOL network fee**. At the test-only mock price and 50% markup, the customer paid **153.073920 NEIRO** in total. Independent readback verified every transaction signature, unchanged saved transaction bytes, all SOL deltas, exact NEIRO transfers and expected mSOL output. Customer SOL was **0 before and after**, with the advance spent inside the same transaction.

Local Surfpool receipt: `Y28gkWWPdqgvWFbmzwLfHdEb6BsU2ztHNW5z5s9fLZaYykfrec1UNTY2axfHch7paB8YMui3MX2JWLKodCTh2AT`, finalized at slot **454817094**. This is a fork receipt, not a mainnet explorer transaction. Successful payment execution through confirmation took **13.229 seconds**; this excludes setup and authoring.

**Listing verification: FAIL after the fork restarted.** The persisted test listing's signed anchor no longer matched the block returned by Surfpool. Verification correctly rejected it, but the agent missed that rejection and called the known Kora endpoint directly. Therefore this proves the tested program operation, local signing and NEIRO-paid sponsorship, **not a complete authenticated NPN discovery-to-payment flow**. Hosted Marinade website integration, remote wallet signing and live pricing were not tested.

All trial services were stopped and temporary keys, credential copies and fork state removed after independent review. Sanitized evidence remains local. No mainnet funds were used.

## App verification scope

- These were local program executions with synthetic funds and mock pricing, not mainnet transactions or live price quotes. Operator accounts and lookup tables were test setup.
- Phoenix onboarding permission was a local fixture. Its SOL collateral went directly into the program-owned trader account; the customer paid NEIRO. Production access was not tested.
- Hosted website wallet connections, metadata uploads, server cosigning and indexing were not verified end to end. Stonkfun, Ember, Hooked, Pump, Meteora DBC and LaunchLab launch tests did not include an initial buy or graduation. Bangfun’s broader coverage is listed above.
- Hooked's P2P initialization passed; transfer-rule enforcement was not tested. An earlier max-wallet attempt failed its rule-account check and is excluded from the passes above.
- Bangfun’s launch builder rejects a zero-SOL wallet, and its signing guard requires the customer as fee payer. Its frontend fee reserves and signing flow need NPN integration changes. TORCH, DEEP, FEAST and SPIN backend workers were not tested because their source was unavailable.
- Bangfun buys also used explicitly sponsored WSOL purchase funding; sells/claims used a separate synthetic settlement treasury to exchange proceeds for NEIRO. These adapters are separate from NPN gas sponsorship. Phoenix collateral is likewise separate from gas.
- The new Pump, Meteora DBC and LaunchLab checks covered launch fees and account rent only, with no purchase funding or settlement adapter. Pump’s `user` account paid creation rent as the operator; the instruction’s separate `creator` field remained the customer. Four new paid transactions finalized, including DBC config creation; customer SOL stayed zero.
- Mock pricing was 1 NEIRO = 0.001 SOL with a 50% operator margin. Charges included account rent where applicable and are not production gas quotes. Production HTTPS, live pricing and unattended operation were not tested. Raw receipts and test data remain local and are not included here.

Launch builder versions: Pump SDK **4.0.0**, Meteora DBC SDK **1.5.13**, Raydium SDK **0.2.74-alpha**.

Environment: Surfpool **1.5.0** and official Kora **2.2.0-beta.8**, built from upstream commit `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a`.

</details>
