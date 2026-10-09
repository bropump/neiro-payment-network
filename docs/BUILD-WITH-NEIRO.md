# Build with NEIRO

**Client / builder guide** · [Tested features](FEATURE-MAP.md) · [Run an operator](../AGENTS.md)

NEIRO Payment Network (NPN) lets a user pay transaction costs in NEIRO while an independent Kora operator supplies the SOL. Keep your existing Solana library, wallet and program instructions. Discover operators onchain and request quotes directly; no router registration or NPN SDK is required.

Use **Solana RPC** for chain reads and confirmation, and the **operator’s Kora endpoint** for quotes and sponsorship. They are different endpoints. Kora accepts HTTP JSON-RPC: keep your existing transaction library and wallet API. Installing Kora’s SDK, Solana Kit or Keychain is optional for payment clients.

## Check your wallet and app first

**NPN sponsors ordinary Solana transactions. A wallet does not need a NEIRO-specific integration, but the app must let you assemble the sponsored transaction before signing.** Check the installed wallet/provider and builder APIs, not the brand name. Reuse the existing wallet; do not create another wallet or run an operator just to make a payment.

| Check | Evidence to look for |
| --- | --- |
| Wallet can sign without sending | `signTransaction`, Wallet Standard `solana:signTransaction`, or an equivalent provider API that returns a signature/signed transaction. It must support the transaction version and preserve the message, third-party fee payer and existing signatures. `signMessage` alone is insufficient. |
| App exposes a build step | Instructions or an unsigned transaction that can be assembled with the operator payer and NEIRO reimbursement **before any required signatures**. Look for build/instructions APIs rather than a send-only convenience method. |
| User needs no SOL for transaction costs | Inspect the actual instructions for SOL debits from the user. For a new standard ATA, set the operator as its creation payer (tested below); existing accounts need no creation instruction. Check other programs’ funding rules only when this operation uses them. SOL being traded is separate from gas. |
| Operator accepts this operation | Its live methods, program/token permissions, limits and balance support the completed transaction. A successful quote alone does not establish signing admission. |

If the wallet only signs-and-sends, or a hosted app hides transaction construction, this guide's user-sign-then-Kora flow is not directly available. Check for a documented co-signing/build API; do not assume incompatibility from the brand or claim support without that path. Never modify an already signed message.

For an untested integration, validate the actual built transaction and wallet signing result: verify the signature and unchanged message bytes. Surfpool is an optional development test environment, not a requirement for using NPN. Simulation does not establish wallet compatibility or successful settlement; only a confirmed payment establishes that the tested operation executed.

Report the exact wallet API, builder API and operator used, followed by **tested**, **not yet tested**, or the specific blocker. Keep this evidence tied to the operation and software versions; a local-keypair transfer does not establish browser-wallet or swap compatibility.

### PayBox for an agent wallet

**Tested: real PayBox signing through the complete NPN client flow on Surfpool.** Reuse an existing authorized Solana wallet: load `PayboxClient.fromConfig()`, inspect `listCredentials()`, then use `requestWalletSign` with the `solanaTransaction` intent to sign the completed, approved transaction. The operator remains fee payer; the customer remains transfer authority. Apply all quote, message, signature, journal and settlement checks below.

The test delivered **1.25 NEIRO** to the recipient and **0.010710 NEIRO** to the operator in one finalized transaction, with customer SOL remaining zero. Reusing the existing profile and autonomous grant was straightforward; first-time PayBox onboarding was not tested. Synthetic funds, seeded token accounts and mock pricing were used; mainnet settlement remains untested. [Exact signing call, versions and receipt →](test-results/paybox-npn-surfpool-2026-10-09.md)

## Start with a payment

You need a signing wallet with NEIRO, a Solana RPC that supports listing discovery, and your existing transaction builder. NEIRO’s mint is `CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump` (6 decimals).

### 1. Find operators

Follow the [RPC filters and signature checks](SPL-RECORD-LISTINGS.md#discovery-and-client-checks) to discover `NEIRO069` records. Authenticate v5 terms, network, mint and their 48-hour validity using trusted finalized chain data. Reject invalid or expired listings individually and continue with other candidates; one bad record must not abort discovery. If none verify, stop without signing.

Each listing supplies the operator, payment destination, URL and pricing terms. Fetch current operator SOL balances with `getMultipleAccounts`; balances are not stored in the listing. Exclude operators unable to cover your transaction.

### 2. Build and request quotes

Build the intended operation for each candidate, using its signer as network fee payer. Keep the user’s wallet as transfer/swap authority. Include account creation and compute-budget instructions, then obtain a fresh blockhash before the final quote.

POST JSON-RPC to the selected operator URL using your existing HTTP library:

| Method | Parameters / result |
| --- | --- |
| `getConfig` | `{}` → live configuration; compare with signed terms. |
| `getPayerSigner` | `{}` → the endpoint's recommended payer/payment identity; a pool may recommend a different signer. |
| `estimateTransactionFee` | `{transaction, fee_token, signer_key}` → quoted `fee_in_token` and `payment_address`. |
| `signTransaction` | `{transaction, signer_key}` → `signed_transaction`; use only after approval and user signing. |

Here `transaction` is the **base64 serialized Solana transaction**, `fee_token` is the NEIRO mint and `signer_key` is the selected operator public key. `fee_in_token` is an integer in raw NEIRO units: 1,000,000 units = 1 NEIRO. Use the JSON-RPC envelope `{"jsonrpc":"2.0","id":1,"method":"…","params":{…}}`; handle both HTTP errors and JSON-RPC `error`. These are Kora methods, not Solana RPC methods. The [official walkthrough](https://solana.com/docs/tools/kora/guides/full-demo) also shows the optional SDK path.

Require the selected operator in `getConfig.fee_payers`. Pin `signer_key` in every quote/sign request and require the quote's `signer_pubkey` and `payment_address` to match the authenticated listing. `getPayerSigner` takes no signer selector; its recommendation must not silently replace your selected operator. The publisher has a stricter [pool limitation](SIGNING.md#listing-runner-compatibility).

For paid modes, append a normal NEIRO token transfer to the verified payment address’s token account. Kora SDK `getPaymentInstruction` is an optional **local helper**, not a server RPC method; its amount is provisional. Quote and independently verify the completed transaction. If its reimbursement differs, replace that transfer’s amount and re-quote before signing. Bound retries (for example, three attempts); stop if no verified amount stabilizes. Sum the completed message's reimbursement transfers and require exact equality with the verified fee: a leftover placeholder plus the corrected transfer is an overpayment, even when the quote itself is valid.

### 3. Verify and select

Check the live payer, payment destination, mint, oracle and pricing against the signed listing. Independently calculate reimbursement and enforce the user’s maximum NEIRO fee. Matching `getConfig` alone does not verify a quote.

- **Margin:** verify chargeable costs, price conversion, markup and rounding.
- **Fixed:** verify the fixed amount and admission policy.
- **Free:** expect zero reimbursement. Omit `fee_token` from `estimateTransactionFee` to avoid unnecessary oracle conversion; do not add a reimbursement instruction.

The [reference quote checker](../tools/kora-publisher/client/README.md) covers these modes, but needs independently calculated costs where applicable. It does not calculate every program’s costs. Reject operations whose costs or price inputs you cannot verify. The current default `maxAgeSlots: 0` disables oracle-age rejection; it does not establish a fresh price. Apply your own explicit price-quality policy.

### 4. Approve and sign

**Keep discovery, quote comparisons and diagnostic probes unsigned.** Releasing a customer-signed payment to Kora authorizes that operator to complete and broadcast it, even when the method is called `signTransaction`. Only release the one approved payment to the selected operator. Normal clients do not need to run operator rejection probes before each payment; use the [isolated integration checks](#test-your-client-before-use) when developing or validating an integration.

Re-read the chosen listing; if its terms changed, get a new quote. Decode the completed transaction, including lookup tables. Check fee payer, recipients, amounts, account authorities, reimbursement and compute budget.

Before collecting signatures, call Solana RPC `simulateTransaction` on the completed base64 transaction with `encoding: "base64"`, `sigVerify: false` and `replaceRecentBlockhash: false`. Reject a non-null `result.value.err`. This tests execution without submitting or collecting operator signatures; it does not verify signatures or guarantee later execution. If simulation reveals a needed instruction, account, fee or blockhash change, rebuild and repeat the quote and message checks.

Show the operation and full NEIRO charge to the user, then sign within their authorization. Verify the user and other application signatures while preserving the approved message. The operator signature is added in step 5.

If the blockhash expires before releasing any customer signature, rebuild and repeat quote verification, message inspection and approval before collecting fresh signatures. After signature release, the operator may already have broadcast; follow step 5 recovery before authorizing a replacement, even if your client has not broadcast anything. Never edit an already signed message. Keep this operator selected through submission. A quote-only request ends before signing. If sponsorship is unavailable, report that; never silently spend the user’s SOL.

### 5. Submit and confirm

With Kora’s `signTransaction`, verify the returned message is byte-for-byte what the user approved and verify all required signatures before broadcasting. With `signAndSendTransaction`, Kora broadcasts: reconcile its returned signature and independently check the transaction and effects through RPC.

**Save recovery state before sending any customer signature to Kora**, including `signTransaction`, not just before your own RPC broadcast. Durably save the operation ID, exact approved message and customer-signed bytes, selected operator, amounts, fee cap, blockhash and last valid block height. Add the expected transaction signature and fully signed bytes when available, before broadcasting them. Keep signed bytes private; they can authorize execution.

On startup, check for a pending operation **before writing new evidence, requesting another signature or replacing its journal**. Use exclusive ownership for that operation and atomic, durable state writes. Reconcile the saved signature and transaction through RPC. If the operator withheld its fee-payer signature, reconcile the exact saved message against chain history; if that cannot be established reliably, leave the operation unresolved and stop. A timeout or expired blockhash alone does not prove the original transaction never landed. Do not automatically create a replacement payment. Rebroadcasting identical fully signed bytes is different from authorizing a new message. Return the confirmed transaction link and actual charge.

## Use your existing program or transaction builder

**Changing the transaction fee payer alone does not make every operation SOL-free for the user.** Account-creation instructions have their own funder.

| Role | Who to use |
| --- | --- |
| Network fee payer | Selected operator |
| New account/rent funder | Operator, where the program supports a separate payer |
| Transfer/swap authority | User’s wallet |
| NEIRO reimbursement recipient | Signed listing’s `payment` address |
| Additional account signers | Those required by the original program |

**Standard ATA creation is supported in our tested flow.** The [Solana ATA instruction](https://github.com/solana-program/associated-token-account/blob/main/interface/src/instruction.rs) takes separate funding and wallet-owner accounts. Our [Surfpool test](test-results/client-practices-surfpool-2026-10-07.json) used the operator as funder and recipient as owner: the operator paid 2,039,280 lamports of account rent plus 10,200 network fees, received NEIRO reimbursement, and the user remained at zero SOL. These are measured test amounts, not constants to hardcode.

Funding an ATA does not give the operator control of it. Test cleanup used the recipient’s signature to close the emptied ATA and return rent to the operator, consistent with [Solana’s close-authority rules](https://solana.com/docs/tokens/basics/close-account).

**Pump.fun buy from a zero-SOL wallet is also tested.** Use the operator as `payer` in `init_user_volume_accumulator` while keeping the buyer as `user`; use the operator to fund the buyer's token ATA. In the buy transaction, explicitly advance the required SOL from the operator to the buyer and reimburse the operator in NEIRO for the advance, rent and network fee under its advertised pricing. Our buyer started and ended at zero SOL and received the purchased tokens. This requires an operator that permits and quotes the advance; Kora does not add it automatically. [Exact tested sequence, amounts and limits](test-results/pump-buy-surfpool-2026-10-08.md).

For another program, inspect its actual instructions and documented account roles. Preserve swap slippage, minimum output, lookup tables and setup/cleanup instructions. Do not infer a funding restriction merely because the app is untested, or replace every user address with the operator.

For the tested classic SPL transfer with one new ATA, costs are `getFeeForMessage` for the completed message plus `getMinimumBalanceForRentExemption(165)`. Priority fees are already included in the network fee. Existing ATAs add no rent. Other account types and program outflows need their own calculation.

## Fast, verified operator selection

| Preference | Selection rule |
| --- | --- |
| Fastest quote | Return the first fully verified quote immediately; do not wait for slower candidates. |
| Cheapest quote | Compare verified total charges until a deadline; report how many operators responded. |
| Sufficient capacity | Check live SOL covers fees and sponsored account funding; more SOL does not mean faster or cheaper. |

Cache authenticated listings, batch balance reads and quote a bounded shortlist in parallel. Rotate candidates and temporarily back off from dead endpoints. Recheck selected terms before approval. A shortlist cannot prove globally cheapest, and fast quotes do not guarantee fast finality.

Set one absolute selection deadline using a monotonic clock, covering every candidate's config fetch, quote/correction loop and verification. Pass its cancellation signal and remaining budget through each HTTP request and body read. A socket inactivity timeout is insufficient: a server can keep sending small chunks. Per-request timeouts must not restart the overall budget. Restrict untrusted listing URLs, private/local destinations and redirects; bound response sizes.

For fastest, return the first **fully verified** success from the selection function immediately. Cancel losing requests and handle their rejections in the background; do not await them in the return path or in `finally`. `Promise.any()` alone does not impose a deadline. For cheapest, retain verified successes received before the cutoff and choose the lowest at the cutoff, or earlier once all candidates finish. At the deadline, return a retained candidate or a no-verified-quote error without waiting for unfinished tasks. Send wallet signatures only after selection, to the selected operator.

Measure discovery, quote/verification, selected-result delivery and confirmation separately with a monotonic timer. Distinguish cold discovery from cached selection.

## Test your client before use

Use disposable wallets and synthetic funds for fault tests. A normal payment client needs no extra signed security probes. The existing listing and quote verifiers check their inputs; they do not enforce your HTTP deadlines, signature custody or journal recovery.

| Boundary | Required test and passing result |
| --- | --- |
| Signature release | Capture outbound requests: discovery, losing candidates and diagnostics receive no customer-signed asset-moving transaction. Only the selected operator receives the approved payment. Do not sign a payment just to see whether a server rejects it. |
| Expected rejection | Use an unsigned, non-asset-moving probe when the endpoint supports that validation path. Match the actual expected RPC error code/reason. A timeout, authentication failure, disabled method or unrelated simulation failure is **inconclusive**, never PASS. If unsigned validation cannot reach the check, report it untested or use a separately authorized isolated fixture. |
| Absolute deadline | Make one endpoint stream small chunks indefinitely. Selection and response-body reads must stop at the overall deadline; a valid candidate already received remains usable. |
| Fastest return | Keep a losing candidate pending. Assert the actual selection promise resolves with the verified winner while the loser is still pending. An early log entry is insufficient. |
| Pending-payment recovery | Stop after saving the customer-signed attempt and before receiving the operator response, then restart. Assert the original journal survives and no new message is signed or sent until reconciliation establishes the outcome. Test concurrent attempts against the same operation ID too. |
| Discovery isolation | Mix one malformed/expired record with a valid listing. Reject only the bad record and continue with the valid operator. |

For rejection assertions, capture the RPC error first, then check its code/reason **outside** any catch that labels the test PASS. A failing assertion must fail the test. Never interpret “some exception occurred” as proof of the intended security rule.

These checks target the [mistakes found in ten independent client implementations](test-results/ten-independent-clients.md). Passing a payment proves that operation settled; it does not substitute for these failure-path tests.

## Optional routers and indexers

Anyone can build a router or indexer to discover operators, cache listings or compare quotes. Clients can choose another service or call operators directly; no central registration is required.

Routers must apply the same v5 signature, authority, network and finalized-anchor checks, reject legacy or expired listings, and fetch live balances and quotes. Report which operators and time window were compared. A router's fastest response is measured from its location and may differ from the client's; cheapest depends on the completed transaction and current pricing inputs.

Clients still independently verify the selected listing, quote and exact transaction before signing, and keep the chosen operator through submission. A recommendation is not proof of an honest fee. Check an existing router's implementation before assuming it supports this format.

## Surfpool verification — 7 October 2026

The [test report and timings](test-results/client-practices-surfpool-2026-10-07.md) cover two operators, verified fastest/cheapest selection, rejection checks, and a NEIRO payment with **zero user SOL**, including new ATA rent and cleanup. This proves the tested transfer flow; it does not establish arbitrary-program compatibility or mainnet latency. Landed failures can still charge the operator network fees.

Fresh-agent findings and wallet coverage: [7 October uptake tests](test-results/agent-uptake-2026-10-07.md).
