# Build with NEIRO

Keep your existing Solana SDK, program instructions and wallet. Use official Kora to have an independent operator supply SOL for transaction costs and receive NEIRO. You do not need an NPN SDK, a new CLI or a mandatory router.

Your normal Solana RPC still handles chain reads and confirmation. The selected operator’s Kora endpoint handles sponsorship quotes and signing. An operator URL is not a replacement for your Solana RPC URL.

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

## Use your existing program or transaction builder

Build the operation with the selected operator before asking the wallet to sign. For each candidate, rebuild the same intended operation with that candidate’s payer and fee destination; compare the verified total fee, not the same serialized transaction sent to different payers.

| Transaction role | Use |
| --- | --- |
| Network fee payer | Selected operator’s public key in the Solana message |
| Account creation/rent funder | Operator only where the program/builder supports that payer; otherwise the user still needs SOL for that instruction |
| Transfer, swap, mint or position authority | User’s existing wallet or the program’s intended authority |
| NEIRO reimbursement destination | Verified signed listing’s `payment` address; it may differ from the operator |
| New account/keypair signers | Preserve the signers required by the original program |
| Account closure/rent destination | Explicitly agreed recipient, normally the original rent funder for disposable tests |

For a classic SPL transfer to a missing ATA, use the operator as the ATA-creation payer, the recipient as the token-account owner, and the user as transfer authority. Changing only the message fee payer does not change an instruction’s rent payer. The recipient’s ATA is still controlled by the recipient, so the sponsor cannot assume it can reclaim that rent later.

For Jupiter, preserve the route, slippage/minimum output, lookup tables, account setup and cleanup instructions. For Meteora/other account-creating programs, preserve the program’s configuration, authorities and extra account signers and explicitly select the creation payer. Do not replace every occurrence of the user’s address with the operator. If the builder fixes the user as funder or requires signatures before sponsorship can be added, adapt that builder flow or report it unsupported.

Use the official Kora SDK to obtain the reimbursement instruction. Add it and the intended compute-budget settings before final approval; recompute the full cost and quote after any instruction change. Decode the complete message and resolved lookup tables before signing. The [reference quote checker](../tools/kora-publisher/client/README.md) accepts an independently calculated `costLamports`; it does not discover all costs for an arbitrary program.

For the tested classic SPL + new ATA shape, the cost basis is the RPC’s `getFeeForMessage` for the complete message plus `getMinimumBalanceForRentExemption(165)` for the new classic token account. The network-fee result already includes priority fees: do not add those twice. Existing ATAs add no new rent. Do not apply this 165-byte rule to Token-2022, arbitrary account creation or unknown CPI outflows. Simulation can help establish those costs, but state can change before execution and a successful simulation is not a settlement guarantee.

With `signTransaction`, verify the returned message bytes exactly match those the user approved, verify all required signatures, and submit that same wire transaction through your RPC. With `signAndSendTransaction`, the operator broadcasts; compare its returned signature with the expected signed transaction when available and independently confirm effects. Never automatically re-sign a changed message. The operator must remain the selected fee payer in both flows.

## Fast, verified operator selection

Use this flow in clients and agent integrations; an optional router can suggest candidates but cannot replace these checks.

1. **Discover and authenticate.** Scan the Record program with the NEIRO069 filters and verify v5 signatures, derived addresses, network, mint and chain expiry. The record commits to the operator, payment destination, URL, oracle and fee model; it does not contain a live SOL balance or prove uptime. Use a trusted RPC, or independent RPC agreement for higher assurance. A signature alone cannot prove the latest terms or a complete discovery result.
2. **Batch live reads.** Fetch payer balances with `getMultipleAccounts` (up to 100 per request). Exclude operators unable to cover the intended transaction’s fees and sponsored rent. A high SOL balance is capacity, not evidence of honesty or speed. Cache authenticated listings and recent latency observations to avoid scanning on every payment; refresh in the background and re-read the selected record and balance before final approval. Never extend chain expiry because a cache is warm.
3. **Quote a bounded shortlist in parallel.** Use the same intended operation, including account creation and priority fee policy, for every candidate. Start with previously responsive candidates plus a rotating sample so new operators can be found. Bound concurrency, response size and deadlines; reject private/local DNS destinations and unsafe redirects. Back off temporarily from dead endpoints. Do not call all operators for every payment unless a complete comparison is required.
4. **Verify before ranking.** Match live payer, payment destination, mint, oracle and pricing mode to signed terms. Independently compute the full reimbursement, including cost basis, conversion and rounding. For free expect zero reimbursement; for fixed verify the configured amount and admission policy; for margin verify calculated costs plus the advertised markup. Apply a client-owned price-quality policy and maximum fee. Matching `getConfig` alone is insufficient. If required price data or rules cannot be verified, reject the quote.
5. **Choose the requested trade-off.** Fastest means the first fully verified quote for this operation from this client: return it immediately and cancel or ignore remaining read-only tasks. Cheapest means the lowest verified total fee among candidates responding within the deadline. Report how many were compared; a shortlist cannot prove globally cheapest. A useful hybrid is the first verified quote below the user’s fee cap. Historical latency helps shortlist but is not a guarantee of submission or finality speed.
6. **Pin and approve once.** Re-read selected terms; if they changed, re-quote. Inspect the exact completed transaction: fee payer, instructions, transfer amounts, recipients, account authorities, NEIRO reimbursement, compute budget and blockhash validity. Resolve lookup tables before inspection. Obtain the user’s signature only for the approved message. Do not let a config change authorize a higher charge. Keep the chosen operator pinned through submission and reconcile the original transaction signature before retrying or switching after an uncertain send; otherwise duplicate payments are possible.

Measure scan, batch reads, quote round trip, verification, time to selected result, and confirmation separately with a monotonic timer. Selection time includes verification, not just the HTTP response. Report cold discovery separately from cached selection, sample count and failures. These are client implementation practices: the publisher’s `discover` command authenticates records but does not implement a payment router or quote race.

## Speed without skipping checks

- Keep an authenticated candidate cache and update it in the background. Deduplicate finalized anchor-block reads and reuse a single sufficiently recent finalized Clock read for the batch. Recheck the selected listing before approval; cached signatures cannot prove latest state.
- Batch balances instead of one request per operator. Reuse HTTP connections and perform independent config/price/account reads concurrently, with bounded concurrency and response sizes. Do not send wallet signatures to competing operators during selection.
- A quote task counts as successful only after fee and identity verification. `Promise.race()` on raw HTTP responses can select an invalid response or fail on a dead endpoint. For fastest, use the first successful verified task (for example, `Promise.any()`), with a deadline on every task; stop waiting for other read-only tasks after returning the winner. For cheapest, wait only until the comparison deadline and report coverage.
- Handle all rejected tasks. Do not put an awaited `Promise.allSettled()` in a `finally` block before returning the fastest result: that removes the latency benefit. Cancel pending fetches or consume their outcomes in the background.
- Measure with `performance.now()`: discovery, authentication, balance reads, quotes, verification, selected-result delivery and confirmation are different timings. Local test milliseconds are not estimates of internet or mainnet latency.

## Errors, changes and safe retries

| Situation | Client response |
| --- | --- |
| HTTP timeout, 403, 405 or non-JSON response | Mark the endpoint unavailable for this attempt; do not assume success or parse an empty body as JSON. Apply a short backoff. |
| HTTP 200 with JSON-RPC `error` | Treat as a failed request and retain its sanitized cause. |
| Changed terms, fee mismatch, wrong recipient or unsupported cost model | Reject before signing. Refresh and re-quote only under the user’s existing limits. |
| Old oracle data | Follow the client’s explicit price-quality policy. `maxAgeSlots = 0` accepts age risk; it does not make a price current. Never silently switch to free sponsorship or user-funded SOL. |
| Quote succeeds but signing rejects | Check live caps, sponsor balance, account rent and program permissions. An estimate is not an admission guarantee. |
| Submission response is lost | Persist and query the original signature. Do not rebuild with a fresh blockhash or another operator until the old attempt is conclusively resolved. |
| Same signed transaction is rebroadcast | The signature stays the same. This is different from signing another payment with a new message/blockhash. |
| Blockhash expires | Resolve whether the original landed, using signature history and blockhash validity/last-valid block height. A wall-clock timeout alone is not proof that it failed. |
| Transaction lands with an execution error | Report the failed operation and charged network fee. Instruction effects, including NEIRO reimbursement, roll back. |

Persist the expected signature and blockhash lifetime before submission. Use a consistent commitment policy for blockhash retrieval, preflight and confirmation. Keep an explicit `unknown`/`pending` outcome when RPC data cannot establish the result. Never respond to uncertainty by issuing a second payment automatically.

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

## Surfpool verification — 7 October 2026

These checks executed against two isolated, unchanged Kora instances and a Surfpool mainnet fork, using fresh local-only keys, synthetic balances and a deterministic Mock oracle. The signed listing URLs were mapped to loopback test endpoints; this does not test public HTTPS or live Jupiter price quality. It is not a mainnet benchmark. [Machine-readable results](test-results/client-practices-surfpool-2026-10-07.json).

- Published, discovered and authenticated two real v5 SPL Record accounts; read operator balances in one RPC batch.
- Independently calculated a classic SPL transfer plus missing recipient ATA: 10,200 lamports network fee (including 200 priority) + 2,039,280 rent. Quotes matched the listed 5% and 10% margins exactly under the fixture price.
- Rejected an overcharge, changed live pricing, wrong payment destination, low client fee cap, stale fixture price, tampered record and changed returned message. The exact 48-hour expiry check used injected trusted context; it was not a 48-hour wall-clock run.
- Live Kora signing rejected a transaction touching its denied listing and a 100,001-lamport priority fee against a 100,000 cap.
- A dead endpoint and a first-arriving invalid quote did not win the verified quote race. Across five controlled rounds, the cheaper operator had an injected 250 ms delay: fastest returned the other verified result without waiting, while cheapest selected the cheaper quote after comparison.
- Submitted the approved sponsored transfer with zero user SOL. Confirmed one token base unit reached the recipient, exact NEIRO reimbursement reached the operator, and the operator paid the independently calculated SOL cost. Rebroadcasting the same signed transaction did not produce a second payment or fee; Surfpool reports it as already processed.
- Returned the recipient’s test token, closed its newly created ATA and returned all 2,039,280 lamports of rent to the sponsor, then closed both listings. These accounts were controlled test fixtures; ordinary clients cannot close someone else’s ATA.

Local measured timings: discovery **106.0 ms**, authentication **3.6 ms**, batched balances **0.4 ms**. Median verified fastest-result delivery **4.9 ms** versus **256.1 ms** waiting for both, with the intentional 250 ms delay included. These values demonstrate return behavior on this local machine, not expected production speed.

The 104 existing reader/quote tests also passed. This run does not establish arbitrary-program cost calculation, browser-wallet compatibility, Jupiter swap execution or Meteora launch compatibility. Earlier launch tests have a separate scope; do not infer those results from this transfer.
