# NPN feature map

NPN lets users reimburse an operator in NEIRO for Solana transaction costs. Use your existing wallet, transaction builder and Solana RPC; call the operator through HTTP JSON-RPC. No NPN SDK, CLI or router registration is required.

**Read the scope:** “Tested on Surfpool” means a transaction executed on a local fork. It does not establish mainnet performance or support for every wallet and program. “Untested” does not mean incompatible.

## Payments and wallets

| Feature or path | Evidence | What to use or check |
| --- | --- | --- |
| NEIRO transfer with zero user SOL | **Tested on Surfpool**, including a new recipient ATA | Operator pays network fees and ATA creation; user signs the transfer and NEIRO reimbursement. [Results](test-results/client-practices-surfpool-2026-10-07.md). |
| Jupiter NEIRO ↔ USDC swaps | **Tested on mainnet**, plus a separate Surfpool route | Two finalized mainnet swaps through Bunny Kora, reimbursed in NEIRO. Historical router integration. [Evidence](test-results/swaps-and-wallets.md#jupiter). |
| MiniRouter deposit swap | **Tested on Surfpool**, directly through Kora and through the earlier router | Adapted NEIRO → USDC order settled with zero customer SOL. Real MiniRouter account credit remains untested. [Evidence](test-results/swaps-and-wallets.md#minirouter). |
| USDC transfer with NEIRO reimbursement | **Tested on Surfpool**, new recipient ATA | Operator funded rent and gas; customer transferred USDC while holding zero SOL. [Evidence](test-results/swaps-and-wallets.md#other-earlier-program-checks). |
| pay.sh local wallet signing | **Tested on Surfpool** | Local file-keystore signer completed NEIRO ID registration/tips and Pump launch with Kora. Not a stock solOS integration. [Evidence](test-results/swaps-and-wallets.md#paysh). |
| SOL transfer with gas paid in NEIRO | **Tested on Surfpool** with a local signer | User supplies the SOL being sent; operator supplies gas SOL. [Results](test-results/agent-uptake-2026-10-07.md). |
| Token creation, ATA creation and minting | **Tested on Surfpool with real PaySponge signing** | Classic SPL mint; user kept authority and stayed at zero SOL. [Exact wallet API and versions](test-results/agent-uptake-2026-10-07.md#paysponge-reproducibility). |
| Pump.fun bonding-curve buy from a zero-SOL buyer | **Tested on Surfpool** with local signing | Operator funds the buyer-account setup, token ATA and an explicit SOL advance for the purchase; buyer reimburses in NEIRO and retains the tokens. Buyer started and ended at 0 SOL. Requires these funding instructions, not just a different fee payer. [Results and transaction sequence](test-results/pump-buy-surfpool-2026-10-08.md). |
| Marinade SOL deposit for mSOL from a zero-SOL customer | **Gas sponsorship tested on Surfpool**, local signing | Operator funded 0.1 SOL principal, ATA rent and gas; customer paid NEIRO and received mSOL. Final listing verification failed after fork restart, so complete authenticated NPN flow is **not established**. [Results and limits](../Client%20verifications/README.md#marinade--separate-trial-9-october-2026). |
| Privy and Turnkey hosted signing | **Untested: test credentials unavailable** | Local fallback tests do not prove these services. Use their authorized sign-only API and verify unchanged message bytes. |
| Para and browser-wallet flows | **Untested in these runs** | Check the wallet’s signing API and transaction-version support. |
| Other swaps, buys and program calls | **Operation-specific verification needed** | Inspect the actual builder and account funders. Gas sponsorship does not automatically fund a purchase or every program-required deposit. |

[Start a payment →](BUILD-WITH-NEIRO.md#start-with-a-payment) · [Check a wallet/app →](BUILD-WITH-NEIRO.md#check-your-wallet-and-app-first)

## Discovery, selection and fees

| Feature | Where it happens | Evidence / boundary |
| --- | --- | --- |
| Discover operators without a router | Client scans SPL Record accounts through Solana RPC | **Tested on Surfpool.** One signed listing per operator; no shared directory administrator. [Record format](SPL-RECORD-LISTINGS.md#discovery-and-client-checks). |
| Authenticate URL and advertised terms | Client checks operator signature, record/network binding and chain-based validity | **Tested**, including tampered and expired records. A signature does not prove endpoint uptime or an honest quote. |
| Check available SOL | Client batches live operator account reads | **Tested.** Balance comes from RPC, not from the listing; it is not reserved for your payment. |
| Choose fastest | Client returns the first fully verified quote | **Tested with controlled delays.** Quote speed does not guarantee settlement speed. |
| Choose cheapest | Client compares verified total charges within its deadline | **Tested with two operators.** Cheapest among those compared, not a claim about every operator. |
| Verify margin, fixed or free pricing | Client independently checks costs, conversion and advertised pricing rules | **Calculation tests cover all three.** The linked paid transaction tests used margin pricing. [Checker scope](../tools/kora-publisher/client/README.md#existing-pricing-modes). |
| Verify the final NEIRO charge | Client re-quotes the complete transaction, including reimbursement | **Tested.** Preliminary helper estimates can differ; correct and re-quote before signing. |

[Selection and speed →](BUILD-WITH-NEIRO.md#fast-verified-operator-selection) · [Exact HTTP calls →](BUILD-WITH-NEIRO.md#2-build-and-request-quotes)

## Operator operation and protection

| Feature | Implementation | Boundary |
| --- | --- | --- |
| Publish and renew fee terms | Node.js runner creates/updates the signed listing; renews after 24 chain hours | Readers reject it at 48 hours. Renewal does not prove that the endpoint responds. [Operator setup](../README.md#set-up-your-operator), [renewal](RENEWAL.md). |
| Protect the listing from public signing requests | Deny that operator’s listing account in every Kora instance sharing its key | Signing rejection **tested on Surfpool**; the running config must enforce it. Other operators retain control of their own listings. |
| Limit priority fees and sponsor spending | Kora’s configured validation limits | Above-cap priority signing rejection **tested**. Limits reduce exposure; they do not guarantee reimbursement after execution failure. |
| Preserve approved transactions | Wallet and Kora signatures cover the same message | Changed-message rejection **tested**. Refreshing the blockhash requires fresh signatures. |
| Recover test ATA rent | Owner/close authority closes an eligible empty account | **Tested.** Paying to create an ATA does not give its funder authority to close it. |
| Guarantee no operator loss on failed execution | **Not provided** | A landed execution failure can charge SOL fees while NEIRO reimbursement rolls back. |

Evidence dates: 27 September–9 October 2026. [All recorded client/app checks](../Client%20verifications/README.md). This map describes documented capabilities and test coverage, not current operator availability. Add a wallet or program to “tested” only with its exact operation, versions and transaction evidence.
