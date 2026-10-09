# Client verifications

## Surfpool app checks — 9 October 2026

The flows below completed using an actual official Kora operator connected to a local Surfpool fork. Customer wallets started with NEIRO only and remained at **0 SOL**. The operator supplied SOL and received the customer's NEIRO payment.

| Application | Result | What was tested |
|---|---|---|
| Stonkfun | PASS | Created a Token-2022 LaunchLab curve using Stonkfun's platform, allow-config and curve-rule accounts. Verified the creator, platform and token supply. |
| Ember | PASS | Created a Meteora DBC pool using Ember's reusable config and launch memo. Verified the creator and config. |
| Hooked — P2P-only | PASS | Created a Token-2022 DBC pool and initialized the actual P2P hook. Verified the hook rule account, creator and mint linkage. |
| Phoenix — DOGE perps | PASS | Registered a trader, deposited operator-funded collateral directly into the trader account, bought 100 DOGE and sold all 100. Verified the final DOGE position was zero. |
| Bangfun | PASS — gas sponsorship | Launches with 1 billion and 500 million supply; curve buys/sells and creator claims; 1 billion curve graduation; graduated DAMM buy/sell and creator claim. Verified finalized state across 25 transactions. Current website requires NPN integration changes. |
| Pump | PASS | Launched a regular SOL-paired Token-2022 coin with `create_v2`. Operator paid fees and account rent; customer remained the recorded creator. Verified curve, 1 billion supply and revoked mint/freeze authority. No initial buy. |
| Meteora DBC | PASS | Created a new DBC configuration and launched its classic SPL curve. Operator paid fees and account rent; verified customer creator, fee recipient, config, 1 billion supply and revoked mint/freeze authority. No initial buy. |
| Raydium LaunchLab | PASS | Launched a Token-2022 curve using Raydium’s default platform/config. Operator paid fees and account rent; verified customer creator, platform, config, 1 billion supply and revoked mint/freeze authority. No initial buy. |

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
- Hosted website wallet connections, metadata uploads, server cosigning and indexing were not verified end to end. Stonkfun, Ember, Hooked, Pump, Meteora DBC and LaunchLab launch tests did not include an initial buy or graduation. Bangfun’s broader coverage is listed above.
- Hooked's P2P initialization passed; transfer-rule enforcement was not tested. An earlier max-wallet attempt failed its rule-account check and is excluded from the passes above.
- Bangfun’s launch builder rejects a zero-SOL wallet, and its signing guard requires the customer as fee payer. Its frontend fee reserves and signing flow need NPN integration changes. TORCH, DEEP, FEAST and SPIN backend workers were not tested because their source was unavailable.
- Bangfun buys also used explicitly sponsored WSOL purchase funding; sells/claims used a separate synthetic settlement treasury to exchange proceeds for NEIRO. These adapters are separate from NPN gas sponsorship. Phoenix collateral is likewise separate from gas.
- The new Pump, Meteora DBC and LaunchLab checks covered launch fees and account rent only, with no purchase funding or settlement adapter. Pump’s `user` account paid creation rent as the operator; the instruction’s separate `creator` field remained the customer. Four new paid transactions finalized, including DBC config creation; customer SOL stayed zero.
- Mock pricing was 1 NEIRO = 0.001 SOL with a 50% operator margin. Charges included account rent where applicable and are not production gas quotes. Production HTTPS, live pricing and unattended operation were not tested. Raw receipts and test data remain local and are not included here.

Launch builder versions: Pump SDK **4.0.0**, Meteora DBC SDK **1.5.13**, Raydium SDK **0.2.74-alpha**.

Environment: Surfpool **1.5.0** and official Kora **2.2.0-beta.8**, built from upstream commit `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a`.
