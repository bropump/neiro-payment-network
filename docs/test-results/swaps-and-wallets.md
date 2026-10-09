# Earlier swap and wallet verification

These results were recovered from saved reports and transaction evidence and consolidated on **9 October 2026**. This is a review of completed tests, not a new execution. September tests used earlier router integrations; they do not establish today's signed-listing discovery flow. Historical versions and fee settings below identify the tested environment, not installation recommendations.

## Jupiter

**Mainnet, 29 September — PASS.** Two swaps finalized through the Bunny router and stock Kora **2.2.0-beta.8**:

| Leg | Swap result | Recorded slot | Network fee |
|---|---|---:|---:|
| Outbound | 10 NEIRO → 0.005067 USDC | 451619732 | 15,000 lamports |
| Return | 0.005067 USDC → 9.941756 NEIRO | 451619916 | 15,000 lamports |

The operator received NEIRO reimbursement including account-creation costs with a 5% markup. The return swap closed the test sender's USDC ATA. Separate owner-authorized cleanup returned the remaining test NEIRO and closed the sender's NEIRO ATA; both accounts were verified absent at finalized commitment. That cleanup was not a sponsored swap. Swap output loss, operator reimbursement and network fees are separate costs.

Recorded quote response times were **479 ms / 380 ms** and submission response times **4,015 ms / 4,016 ms**. WebSocket finalization arrived **11,828 ms / 26,743 ms after tracking began**. These are individual observations, not current performance guarantees or isolated router overhead.

Sources: saved `JUPITER-LIVE-SWAP-REPORT.md` and `JUPITER-LIVE-SWAP-PROOF.json`. The evidence includes transaction signatures and token-balance readbacks. This public summary preserves the earlier reporting choice not to publish the test wallets' mainnet transaction links.

**Surfpool, 27 September — PASS.** A separate test executed live Jupiter instructions using a Raydium route: **1,000 NEIRO → 0.512701 USDC**, with the customer's SOL staying at zero. The operator received **2.514918 NEIRO** and spent **10,000 lamports**. This run used realtokens.xyz pricing and a test price-endpoint override; it must not be described as an unchanged production Kora pricing setup. Forged excessive quotes and excess reimbursement were rejected in the associated checks.

Source: saved `neiro-complex-trust-proof.md` and its JSON evidence. An earlier 27 September mainnet run also settled both swap directions, but its outbound fee estimate omitted a priority fee and under-reimbursed the operator. Successful settlement alone does not establish correct reimbursement for every historical run.

## MiniRouter

**Surfpool, 29 September — PASS for the adapted deposit swap.** Fresh MiniRouter orders supplied unsigned NEIRO → USDC transactions. The test resolved lookup tables and rebuilt the transaction while retaining the customer's swap authority, setting Kora as fee payer and ATA-creation payer, and adding NEIRO reimbursement before collecting signatures.

| Executed path | Destination USDC increase | Operator reimbursement | Operator SOL spent | Customer SOL after |
|---|---:|---:|---:|---:|
| Direct stock Kora | 0.550644 | 2.276751 NEIRO | 2,049,280 lamports | 0 |
| Then-current router in Miniflare → stock Kora | 0.553293 | 2.276751 NEIRO | 2,049,280 lamports | 0 |

Both saved settlement results are `PASS`. These used Kora **2.2.0-beta.8**, disposable signers, synthetic funds and **mock pricing** on a private fork. The router-run fork receipt is `4NZQsBtnuQit7HfMQcnXyHhhCK5DKfvrFT2GqBpRYyA4vqU2S6XeJS1RVqQXfPe98QnLY5vf3kLtACNSNbF1HReE`; it is not a mainnet explorer transaction.

The MiniRouter execution API and actual MiniRouter account credit were not tested. Some orders exceeded the 1,232-byte transaction limit after sponsorship; the successful run used a route that fit. Changing only static account key zero is incorrect because it also changes instruction references to that key: rebuild while preserving the customer as swap owner.

Sources: saved `minirouter-kora-verified-2026-09-29.md` and `minirouter-kora-evidence-2026-09-29.json`, including separate direct and router settlement records.

## pay.sh

**Surfpool, 7 October — PASS.** A pay.sh wallet using its **local file-keystore signing backend** signed the customer side, and Kora supplied its own signature and SOL. Four transactions executed:

| Operation | Customer SOL before → after | NEIRO reimbursement |
|---|---|---:|
| NEIRO ID registration and resolution | 0 → 0 | 3.217680 |
| 1 NEIRO tip to the resolved recipient, new ATA | 0 → 0 | 4.098560 |
| Repeat tip, existing ATA | 0 → 0 | 0.020000 |
| Pump `createV2` launch | 0 → 0 | 14.882640 |

Prices were **mock values with a 100% margin**, not market quotes. Reimbursement excludes the tip principal. Kora funded registration/ATA/launch rent and network fees; the customer retained the intended authority or creator attribution. The Pump launch receipt recorded a 15,000-lamport network fee, distinct from the total quoted cost including rent.

This proves **pay.sh signing + Kora outside stock solOS**. It does not establish a working stock solOS launch/swap command or a hosted pay.sh custody backend. The macOS Keychain import stalled on interactive authorization, so that backend was not the successful path.

Sources: saved `paysh-solos-npn-sim/REPORT.md`, `npn-surfpool/SUMMARY.json`, and `pump-npn-paysh/REPORT.txt` / `SUMMARY.json`. The naming/tipping summary records matching NEIRO reimbursements and zero SOL before/after for all three transactions. The launch summary records its successful transaction separately.

## Para

**Works as a real remote Kora operator signer.** Official Kora using Solana Keychain called Para with an API credential and a dedicated API-managed wallet. The container did not hold that wallet’s Solana private key. Both the initial release-image test and the subsequent upstream-main test confirmed transactions on disposable private ledgers.

The upstream-main run confirmed **legacy, v0 and genuine v1** transactions. All three saved Para receipts have no onchain error, valid independently verified signatures, an unchanged original message and customer signature, and rejection of altered message bytes. An invalid API credential was rejected with HTTP 403. The test used official Kora commit `afe5e6b297c33b71293eb57da80bd8de8b40709a` and an Agave **4.2.2** private ledger.

These were **free sponsorship / mock-pricing tests**, not NEIRO reimbursement tests or a Para customer-wallet integration. Para support in Kora also does not imply Para support in the separate listing runner.

Sources: saved `keychain-signing-test/REPORT.md` / `results.json`, `main-image-test/results.json` and `main-upgrade-private/REPORT.md`. The initial release image passed legacy/v0; upstream main additionally passed v1. No public-chain funds were used.

For **Privy and Turnkey**, the [wallet uptake report](agent-uptake-2026-10-07.md) explicitly records local-key fallback because provider credentials were unavailable. Its successful payments cannot be attributed to those providers’ hosted signing services.

## Other earlier program checks

The **29 September Surfpool application matrix** also records successful USDC transfers to a new recipient ATA, Meteora DBC configuration creation in classic and Token-2022 modes, classic DBC pool creation, classic SPL Raydium LaunchLab creation with a NEIRO quote mint, and an Ember launch rebuilt using its observed config plus a disposable memo signer. Operator-funded costs were reimbursed in NEIRO. These are program-level results, not proof of hosted website integration.

Source: saved `APPLICATION-COMPATIBILITY.md` and its application retry report. Several Token-2022 launch paths were blocked in those older builds; the later [app checks](../../Client%20verifications/README.md#applications--verified-on-surfpool) record successful tested paths and their versions.

For **PaySponge's real signing API**, see the existing [7 October report](agent-uptake-2026-10-07.md#paysponge-reproducibility). For the later zero-SOL **Pump buy**, including purchase funding, see the [8 October report](pump-buy-surfpool-2026-10-08.md). The [verification index](../../Client%20verifications/README.md) brings these results together.
