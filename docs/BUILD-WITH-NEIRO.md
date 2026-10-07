# Build with NEIRO

NEIRO Payment Network (NPN) lets a user pay transaction costs in NEIRO while an independent Kora operator supplies the SOL. Keep your existing Solana library, wallet and program instructions. Discover operators onchain and request quotes directly; no router registration or NPN SDK is required.

Use **Solana RPC** for chain reads and confirmation, and the **operator’s Kora endpoint** for quotes and sponsorship. They are different endpoints.

## Check your wallet and app first

**NPN sponsors ordinary Solana transactions. A wallet does not need a NEIRO-specific integration, but the app must let you assemble the sponsored transaction before signing.** Check the installed wallet/provider and builder APIs, not the brand name. Reuse the existing wallet; do not create another wallet or run an operator just to make a payment.

| Check | Evidence to look for |
| --- | --- |
| Wallet can sign without sending | `signTransaction`, Wallet Standard `solana:signTransaction`, or an equivalent provider API that returns a signature/signed transaction. It must support the transaction version and preserve the message, third-party fee payer and existing signatures. `signMessage` alone is insufficient. |
| App exposes a build step | Instructions or an unsigned transaction that can be assembled with the operator payer and NEIRO reimbursement **before any required signatures**. Look for build/instructions APIs rather than a send-only convenience method. |
| User needs no SOL | Every rent/account-funding instruction supports the operator as funder. Any SOL used as the asset being traded is separate from gas sponsorship. |
| Operator accepts this operation | Its live methods, program/token permissions, limits and balance support the completed transaction. A successful quote alone does not establish signing admission. |

If the wallet only signs-and-sends, or a hosted app hides transaction construction, this guide's user-sign-then-Kora flow is not directly available. Check for a documented co-signing/build API; do not assume incompatibility from the brand or claim support without that path. Never modify an already signed message.

For a new combination, build the actual intended operation, verify its quote and simulate it with a zero-user-SOL fixture on Surfpool. Then test the real wallet's sign-only path within authorization: verify its signature and compare message bytes before/after signing. Simulation with signature checks disabled cannot prove wallet compatibility. Finish with a small authorized end-to-end payment before calling that combination tested.

Report the exact wallet API, builder API and operator used, followed by **tested**, **not yet tested**, or the specific blocker. Keep this evidence tied to the operation and software versions; a local-keypair transfer does not establish browser-wallet or swap compatibility.

## Start with a payment

You need a signing wallet with NEIRO, a Solana RPC that supports listing discovery, and your existing transaction builder. NEIRO’s mint is `CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump` (6 decimals).

### 1. Find operators

Follow the [RPC filters and signature checks](SPL-RECORD-LISTINGS.md#discovery-and-client-checks) to discover `NEIRO069` records. Authenticate v5 terms, network, mint and their 48-hour validity using trusted finalized chain data. Reject invalid or expired listings.

Each listing supplies the operator, payment destination, URL and pricing terms. Fetch current operator SOL balances with `getMultipleAccounts`; balances are not stored in the listing. Exclude operators unable to cover your transaction.

### 2. Build and request quotes

Build the intended operation for each candidate, using its signer as network fee payer. Keep the user’s wallet as transfer/swap authority. Follow the [official Kora transaction walkthrough](https://solana.com/docs/tools/kora/guides/full-demo) to estimate costs and add NEIRO reimbursement.

Include account creation and compute-budget instructions before requesting the final quote. Changing instructions changes costs. See the payer rules below to ensure the user needs no SOL.

### 3. Verify and select

Check the live payer, payment destination, mint, oracle and pricing against the signed listing. Independently calculate reimbursement and enforce the user’s maximum NEIRO fee. Matching `getConfig` alone does not verify a quote.

- **Margin:** verify chargeable costs, price conversion, markup and rounding.
- **Fixed:** verify the fixed amount and admission policy.
- **Free:** expect zero reimbursement. Omit `fee_token` from `estimateTransactionFee` to avoid unnecessary oracle conversion; do not add a reimbursement instruction.

The [reference quote checker](../tools/kora-publisher/client/README.md) covers these modes, but needs independently calculated costs where applicable. It does not calculate every program’s costs. Reject operations whose costs or price inputs you cannot verify. The current default `maxAgeSlots: 0` disables oracle-age rejection; it does not establish a fresh price. Apply your own explicit price-quality policy.

### 4. Approve and sign

Re-read the chosen listing; if its terms changed, get a new quote. Decode the completed transaction, including lookup tables. Check fee payer, recipients, amounts, account authorities, reimbursement and compute budget. Show the operation and full NEIRO charge to the user, then sign within their authorization.

Keep this operator selected through submission. A quote-only request ends before signing. If sponsorship is unavailable, report that; never silently spend the user’s SOL.

### 5. Submit and confirm

With Kora’s `signTransaction`, verify the returned message is byte-for-byte what the user approved and verify all required signatures before broadcasting. With `signAndSendTransaction`, Kora broadcasts: reconcile its returned signature and independently check the transaction and effects through RPC.

Persist the expected signature when available and blockhash lifetime before sending. If the response is lost, resolve the original attempt before signing another payment. Rebroadcasting the same signed transaction is different from creating a new one. A timeout alone does not prove failure. Return the confirmed transaction link and actual charge.

## Use your existing program or transaction builder

**Changing the transaction fee payer alone does not make every operation SOL-free for the user.** Account-creation instructions have their own funder.

| Role | Who to use |
| --- | --- |
| Network fee payer | Selected operator |
| New account/rent funder | Operator, where the program supports a separate payer |
| Transfer/swap authority | User’s wallet |
| NEIRO reimbursement recipient | Signed listing’s `payment` address |
| Additional account signers | Those required by the original program |

For a missing recipient ATA, set the operator as creation payer and the recipient as owner. Preserve swap slippage, minimum output, lookup tables and setup/cleanup instructions. Never replace every user address with the operator. If a program requires the user to fund an account, report that limitation instead of claiming zero-SOL support.

For the tested classic SPL transfer with one new ATA, costs are `getFeeForMessage` for the completed message plus `getMinimumBalanceForRentExemption(165)`. Priority fees are already included in the network fee. Existing ATAs add no rent. Other account types and program outflows need their own calculation.

## Fast, verified operator selection

| Preference | Selection rule |
| --- | --- |
| Fastest quote | Return the first fully verified quote immediately; do not wait for slower candidates. |
| Cheapest quote | Compare verified total charges until a deadline; report how many operators responded. |
| Sufficient capacity | Check live SOL covers fees and sponsored account funding; more SOL does not mean faster or cheaper. |

Cache authenticated listings, batch balance reads and quote a bounded shortlist in parallel. Rotate candidates and temporarily back off from dead endpoints. Recheck selected terms before approval. A shortlist cannot prove globally cheapest, and fast quotes do not guarantee fast finality.

For fastest, race **verified successes**, not raw HTTP responses (`Promise.any()` with per-task deadlines is one option). Do not await every remaining task before returning. Treat HTTP failures and JSON-RPC errors as failures. Restrict untrusted listing URLs, private/local destinations and redirects; bound response sizes. Send wallet signatures only to the selected operator.

Measure discovery, quote/verification, selected-result delivery and confirmation separately with a monotonic timer. Distinguish cold discovery from cached selection.

## Surfpool verification — 7 October 2026

The [test report and timings](test-results/client-practices-surfpool-2026-10-07.md) cover two operators, verified fastest/cheapest selection, rejection checks, and a NEIRO payment with **zero user SOL**, including new ATA rent and cleanup. This proves the tested transfer flow; it does not establish arbitrary-program compatibility or mainnet latency. Landed failures can still charge the operator network fees.
