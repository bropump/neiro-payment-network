# Client verifications

## Surfpool app checks — 9 October 2026

The flows below completed using an actual official Kora operator connected to a local Surfpool fork. Customer wallets started with NEIRO only and remained at **0 SOL**. The operator supplied SOL and received the customer's NEIRO payment. The star.fun row is a structural pass with a local operator keypair instead of Kora; see Scope and limits.

| Application | Result | What was tested |
|---|---|---|
| Stonkfun | PASS | Created a Token-2022 LaunchLab curve using Stonkfun's platform, allow-config and curve-rule accounts. Verified the creator, platform and token supply. |
| Ember | PASS | Created a Meteora DBC pool using Ember's reusable config and launch memo. Verified the creator and config. |
| Hooked — P2P-only | PASS | Created a Token-2022 DBC pool and initialized the actual P2P hook. Verified the hook rule account, creator and mint linkage. |
| Phoenix — DOGE perps | PASS | Registered a trader, deposited operator-funded collateral directly into the trader account, bought 100 DOGE and sold all 100. Verified the final DOGE position was zero. |
| star.fun — presale deposit | STRUCTURAL PASS | Deposited 25 USDC into the PARASOL presale vault with the operator as fee payer and rent payer; the buyer stayed at 0 SOL and paid 10 NEIRO. Operator was a local keypair — Kora quote/sign not exercised. |

## How NPN paid for the flows

1. Published and authenticated a local NPN operator listing, then checked its live Kora config.
2. Built the application instructions with the operator as fee payer and the customer as owner or creator. Included the NEIRO reimbursement in the transaction.
3. Simulated the completed transaction, requested Kora's quote and checked the charge against the signed terms and independently calculated cost.
4. Collected the customer and Kora signatures, verifying that the transaction message stayed unchanged.
5. Submitted to Surfpool and checked finalized success, application state, exact NEIRO transfers and the customer's zero SOL balance.

Kora's listing-account protection and priority-fee cap were also checked.

## Scope and limits

- These were local program executions with synthetic funds and mock pricing, not mainnet transactions or live price quotes. Operator accounts and lookup tables were test setup.
- Phoenix onboarding permission was a local fixture. Its SOL collateral went directly into the program-owned trader account; the customer paid NEIRO. Production access was not tested.
- Hosted website wallet connections, metadata uploads, server cosigning and indexing were not tested. Launch tests did not include an initial buy or graduation.
- Hooked's P2P initialization passed; transfer-rule enforcement was not tested. An earlier max-wallet attempt failed its rule-account check and is excluded from the passes above.
- The star.fun deposit used a structural operator keypair rather than Kora, a patched vault window (all mainnet windows are closed), and synthetic buyer balances. Full evidence is in [starfun-deposit-surfpool-2026-10-09](../docs/test-results/starfun-deposit-surfpool-2026-10-09.md) with [machine-readable results](../docs/test-results/starfun-deposit-surfpool-2026-10-09.json). It proves operation compatibility, not the full operator flow.

Environment: Surfpool **1.5.0** and official Kora **2.2.0-beta.8**, built from upstream commit `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a`.
