# Build with NEIRO

Keep your Solana app. Let an independent Kora operator supply SOL for the transaction and receive NEIRO covering the gas and their tip.

## Start with a payment

1. Ask what the user wants to send, its amount, the recipient and the wallet they already use. Reuse the existing code and wallet adapter.
2. Read the [SPL Record discovery and verification contract](SPL-RECORD-LISTINGS.md#discovery-and-client-checks) and [official Kora transaction walkthrough](https://solana.com/docs/tools/kora/guides/full-demo).
3. Scan listings using Solana RPC, authenticate anchored v5 terms and their fixed 48-hour lifetime against trusted finalized block and Clock data, reject legacy or expired records, read live operator SOL balances and request quotes directly from their listed HTTPS endpoints. Use deadlines and bounded concurrency. Treat listing URLs as untrusted network input.
4. Choose the first fully verified quote for fastest response, or compare verified total fees for cheapest among the responding candidates. Connect the Kora client directly to the chosen URL and keep that operator pinned. Use its signer as transaction fee payer; keep application/token authorities with the user's wallet. Solana RPC supplies account reads, blockhashes and confirmation.
5. Build the user's transaction, including required recipient account creation. Use the current Kora SDK payment-instruction flow to estimate costs and add reimbursement in NEIRO, mint `CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump` (6 decimals). Recheck the completed transaction's quote and policies. Do not hardcode the homepage's base estimate as the final fee.
6. Show the payment amount, recipient, NEIRO reimbursement including the operator tip, and any account deposits. Obtain wallet approval before signing the final message.
7. Submit the wallet-signed transaction through the same operator using the documented signing/submission flow. Follow confirmation with Solana RPC and return an [Orb](https://orbmarkets.io) transaction link.

For an authenticated **free** listing, omit `fee_token` from `estimateTransactionFee`: expect zero lamports and a null/absent token fee, which means no NEIRO reimbursement instruction. Asking Kora to convert even a zero fee into NEIRO can invoke the oracle and reject a stale price unnecessarily. The transfer itself can still use NEIRO. For fixed or margin pricing, request and verify the NEIRO quote normally; never silently fall back to free pricing.

The reference `client/verify-quote.mjs` uses `maxAgeSlots: 0` by default, matching the operator template's acceptance of Jupiter prices without an age cutoff. This does not prove price freshness. Set a positive client-owned limit if required; never let an operator choose or relax it for the client. Signature, fee calculation, recipient, fee cap and future-slot checks still apply.

If the user asks only for a quote, stop before signing or submitting. If no usable operator is discovered, report it; do not invent a quote or silently switch to spending the user's SOL.

## Fast, verified operator selection

Use this flow in clients and agent integrations; an optional router can suggest candidates but cannot replace these checks.

1. **Discover and authenticate.** Scan the Record program with the NEIRO069 filters and verify v5 signatures, derived addresses, network, mint and chain expiry. The record commits to the operator, payment destination, URL, oracle and fee model; it does not contain a live SOL balance or prove uptime. Use a trusted RPC, or independent RPC agreement for higher assurance. A signature alone cannot prove the latest terms or a complete discovery result.
2. **Batch live reads.** Fetch payer balances with `getMultipleAccounts` (up to 100 per request). Exclude operators unable to cover the intended transaction’s fees and sponsored rent. A high SOL balance is capacity, not evidence of honesty or speed. Cache authenticated listings and recent latency observations to avoid scanning on every payment; refresh in the background and re-read the selected record and balance before final approval. Never extend chain expiry because a cache is warm.
3. **Quote a bounded shortlist in parallel.** Use the same intended operation, including account creation and priority fee policy, for every candidate. Start with previously responsive candidates plus a rotating sample so new operators can be found. Bound concurrency, response size and deadlines; reject private/local DNS destinations and unsafe redirects. Back off temporarily from dead endpoints. Do not call all operators for every payment unless a complete comparison is required.
4. **Verify before ranking.** Match live payer, payment destination, mint, oracle and pricing mode to signed terms. Independently compute the full reimbursement, including cost basis, conversion and rounding. For free expect zero reimbursement; for fixed verify the configured amount and admission policy; for margin verify calculated costs plus the advertised markup. Apply a client-owned price-quality policy and maximum fee. Matching `getConfig` alone is insufficient. If required price data or rules cannot be verified, reject the quote.
5. **Choose the requested trade-off.** Fastest means the first fully verified quote for this operation from this client: return it immediately and cancel or ignore remaining read-only tasks. Cheapest means the lowest verified total fee among candidates responding within the deadline. Report how many were compared; a shortlist cannot prove globally cheapest. A useful hybrid is the first verified quote below the user’s fee cap. Historical latency helps shortlist but is not a guarantee of submission or finality speed.
6. **Pin and approve once.** Re-read selected terms; if they changed, re-quote. Inspect the exact completed transaction: fee payer, instructions, transfer amounts, recipients, account authorities, NEIRO reimbursement, compute budget and blockhash validity. Resolve lookup tables before inspection. Obtain the user’s signature only for the approved message. Do not let a config change authorize a higher charge. Keep the chosen operator pinned through submission and reconcile the original transaction signature before retrying or switching after an uncertain send; otherwise duplicate payments are possible.

Measure scan, batch reads, quote round trip, verification, time to selected result, and confirmation separately with a monotonic timer. Selection time includes verification, not just the HTTP response. Report cold discovery separately from cached selection, sample count and failures. These are client implementation practices: the publisher’s `discover` command authenticates records but does not implement a payment router or quote race.

## Give an agent a wallet

A normal Solana keypair is enough. Reuse an existing wallet or signer before introducing another service. The signing choice is independent of NEIRO gas sponsorship.

- **Local keypair:** use the user's existing Solana library and keep the private key in private storage. The agent prepares a transaction and signs only after the agreed approval.
- **Solana Keychain:** use a [supported signing backend](https://solana.com/docs/tools/keychain) through its standard interface.
- **PaySponge:** use the [PaySponge SDK](https://github.com/paysponge/paysponge-sdk) and current sign-only flow when the user wants that service. Preserve the operator fee payer and every instruction.
- **Existing wallet or signer:** keep its normal transaction-signing integration. It must sign the final sponsored Solana message without replacing the fee payer or silently rebuilding it.

Whichever method the user chooses, prepare the complete sponsored transaction, show the payment and NEIRO fee, obtain approval, collect the user's signature and submit through the pinned NEIRO operator. Keep private keys and provider credentials private. Wallet access is separate from permission to spend. Start with a small approved payment and verify the recipient balance and Orb receipt, then reuse the signing integration for swaps and other operations.

## Add a Jupiter swap

Follow [Jupiter's current instruction-building guide](https://developers.jup.ag/docs/guides/how-to-build-a-custom-swap-with-metis). Get a fresh quote and buildable swap instructions. Preserve the user's swap authority, route, minimum output, lookup tables, compute budget, setup and cleanup. Set the operator as fee payer and account funder where required. Add the NEIRO reimbursement before final wallet approval, then submit through the pinned operator. Show swap amounts, slippage and the full gas quote together.

## More recipes

- [MiniRouter agent payments](https://minirouter.sh/docs/agent-payments): fund the service, reconcile credit and verify the paid model response. A swap receipt alone does not prove service credit.
- [Classic SPL token creation](https://solana.com/docs/tokens/basics/create-mint): preserve mint authority, include mint/account creation costs in the sponsorship quote and verify the resulting supply.
- [x402](https://solana.com/docs/payments/agentic-payments/x402) and [MPP](https://solana.com/docs/payments/agentic-payments/mpp): preserve the service challenge, recipient and payment asset. Confirm that the payment verifier accepts the sponsored transaction format. NEIRO gas does not change the asset a merchant requests.
- [NEIRO ID](https://github.com/bropump/neiro-id): register or resolve an onchain name using that project's public protocol. Resolve the destination before building a payment.

## Test and return funds

Agree a small budget before sending. Record every created token account, its owner and rent funder. After a disposable test, return remaining assets when authorized and close newly created empty accounts whose authority the user controls, returning rent to the funder. Do not close existing user accounts or burn non-test assets. A classic mint itself has no ordinary close instruction.

Report what was actually checked: quote, simulation, local fork, mainnet confirmation or paid service response. Preserve transaction receipts. No hosted service, launchpad or facilitator is proven by a plain transfer test.
