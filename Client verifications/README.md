# Client verifications

## Surfpool app checks — 9 October 2026

The flows below completed using an actual official Kora operator connected to a local Surfpool fork. Customer wallets started with NEIRO only and remained at **0 SOL**. The operator supplied SOL and received the customer's NEIRO payment.

| Application | Result | What was tested |
|---|---|---|
| Stonkfun | PASS | Created a Token-2022 LaunchLab curve using Stonkfun's platform, allow-config and curve-rule accounts. Verified the creator, platform and token supply. |
| Ember | PASS | Created a Meteora DBC pool using Ember's reusable config and launch memo. Verified the creator and config. |
| Hooked — P2P-only | PASS | Created a Token-2022 DBC pool and initialized the actual P2P hook. Verified the hook rule account, creator and mint linkage. |
| Phoenix — DOGE perps | PASS | Registered a trader, deposited operator-funded collateral directly into the trader account, bought 100 DOGE and sold all 100. Verified the final DOGE position was zero. |

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

Environment: Surfpool **1.5.0** and official Kora **2.2.0-beta.8**, built from upstream commit `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a`.

## Bangfun — NEIRO-paid gas sponsorship — 9 October 2026

**PASS: NPN gas sponsorship for the tested underlying transactions.** An actual official Kora operator paid the SOL network fees and received NEIRO reimbursement. Customer wallets held **0 native SOL before and after every transaction**. The tests used Bangfun's real Meteora DBC configurations and DBC/DAMM programs on local Surfpool.

| Flow | What passed |
|---|---|
| Launch | Created tokens with both 1 billion and 500 million supply; verified creator, supply and revoked mint/freeze authority. |
| Curve trading | Initial buys, buys, sells and creator fee claims for both supply variants; verified token movements and claim state. |
| Graduation | Reached the 85 SOL curve threshold for the 1 billion variant and created the actual DAMM pool and creator position. |
| Graduated trading | DAMM buy, sell and creator fee claim; verified token movements. Meaningful withdrawal of permanently locked liquidity was rejected. |

All **25 transactions finalized successfully** on Surfpool. NPN listing authentication, quotes, unchanged signed messages, signatures, exact NEIRO transfers and customer SOL balances were checked. Insufficient NEIRO, slippage, protected listing access and excessive priority fees were rejected.

### How gas was paid

The adapted transaction builders set the NPN operator as fee payer and included the customer's NEIRO reimbursement. The customer signed the application instructions, Kora signed for the operator, and the completed transaction was submitted only to local Surfpool.

### Scope

- **Gas sponsorship passed; the current Bangfun website needs NPN integration changes.** Its launch builder rejects a zero-SOL wallet, and its signing guard requires the customer wallet to be the fee payer. Its launch/buy balance checks also reserve SOL for fees. The hosted website was not verified end to end with NPN.
- Purchase principal is separate from gas. These broader tests also used operator-funded WSOL for buys and a separate synthetic treasury to exchange sell/claim proceeds for NEIRO. Those adapters are not automatic NPN gas functionality; the reported NEIRO charges included more than gas where applicable.
- TORCH, DEEP, FEAST and SPIN backend workers were **not tested** because their source was unavailable. Other hosted UI features and metadata uploads were not tested on Surfpool.
- Synthetic funds and mock pricing were used. No mainnet transactions, live pricing or production browser-wallet integration were tested. Raw receipts and test data remain local and are not included in this repository.

Environment: Surfpool **1.5.0**, official Kora **2.2.0-beta.8** at upstream commit `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a`, NPN commit `4a8e22708f5a59936c8b9b26dc1cddce66d52ada`. Official Kora and the NPN listing runner were unchanged.
