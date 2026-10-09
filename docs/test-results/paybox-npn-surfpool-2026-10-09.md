# PayBox agent wallet with NPN — 9 October 2026

**Result: PASS — complete NPN payment on Surfpool using the real PayBox signing service and an isolated official Kora operator.**

PayBox worked as the agent's customer wallet: it signed a Solana transaction with a separate operator fee payer, and Kora added the second signature without changing the message. Authenticated discovery, the operator quote, NEIRO reimbursement and finalized settlement all completed in one payment flow.

## Payment result

| Check | Observed result |
| --- | --- |
| Recipient payment | **1.250000 NEIRO** |
| Operator reimbursement | **0.010710 NEIRO**, in the same transaction |
| Total customer debit | **1.260710 NEIRO** |
| Customer SOL | **0 before → 0 after** |
| Operator SOL network fee | **10,200 lamports** |
| Account-creation rent in this payment | **0**; token accounts were seeded before the test |
| Signatures | Real PayBox customer signature + official Kora operator signature; both verified |
| Settlement | Successful and **finalized** on the local fork |

Finalized local receipt: `4iUXHb4swxd9YpiFHS6iTQtNn8K261Y6Mqv9x56zNjf3AhRoR48TUSs8KHRVfxx5xjdvTLPX3x6QByBE5JybY1Sc`, slot **454856273**. This signature belongs to the test fork; it is not a mainnet explorer receipt. [Sanitized machine-readable evidence](paybox-npn-surfpool-2026-10-09.json).

## Setup for an agent

**Reusing an existing authorized PayBox Solana wallet was straightforward in this run.** The agent loaded its existing local PayBox profile, selected an authorized Solana wallet grant, and called the SDK's sign-only transaction API. Signing used the PayBox SDK and service; no customer key was exported or replaced with a local keypair. The existing profile and wallet were preserved.

For the tested SDK **1.0.0** path:

1. Load `PayboxClient.fromConfig()` and require `canSign`. Use `listCredentials()` to select the intended existing Solana wallet and inspect its grant. This test used an existing grant with `approval_mode: "autonomous"`.
2. Follow the [NPN client sequence](../BUILD-WITH-NEIRO.md#start-with-a-payment): authenticate the operator listing, construct the transaction with the operator as fee payer, add and verify the NEIRO reimbursement, and simulate the final message within the user's authorization.
3. Request PayBox's signature on that exact transaction, verify it, journal the approved payment, and obtain Kora's signature. Verify both signatures and unchanged message bytes, submit through Solana RPC and confirm the actual balances.

The PayBox signing call used was:

```js
// Wallet signing step only, after the completed NPN transaction is approved.
const result = await paybox.requestWalletSign({
  credentialId: selectedCredentialId,
  intent: {
    op: 'solanaTransaction',
    address: customerAddress,
    transactionBase64: approvedTransactionBase64,
  },
});
```

Require `result.status === "success"`. The tested response supplied signed transaction bytes through `result.output.value.signedTransactionBase64` or its `artifact.signedTransactionBase64` field. Decode them and verify the customer signature and exact original message before passing the customer-signed transaction to the selected operator. An autonomous grant does not replace the client's amount, destination and fee checks.

A payment client needs a NEIRO-funded wallet, its transaction builder, Solana RPC and an existing NPN operator endpoint. It does not need to run an operator. **First-time PayBox account creation, grant setup and recovery were not exercised**, so this result does not establish a universal onboarding time or one-command installation.

## What was checked

- Discovered the operator's onchain v5 listing through RPC, authenticated its signature, derived address, network and finalized block anchor, and checked chain expiry.
- Matched live Kora configuration and payer/payment identities to the signed listing.
- Stabilized the completed unsigned quote and independently checked the reimbursement against network costs, deterministic mock conversion and the 5% margin; simulation passed.
- Verified the real PayBox customer signature while the operator signature was still absent.
- Durably recorded the approved message and customer-signed transaction before releasing it to Kora, then recorded the fully signed transaction before submission.
- Verified Kora preserved the message and both required signatures. A separate finalized-receipt readback checked the landed message, both signatures, two NEIRO transfers and exact token/SOL balance changes.

## Test environment and limits

| Component | Tested version / revision |
| --- | --- |
| NPN | `44de5d887aff084f6721c8c34fb0eb497a715349` |
| Official Kora | `2.2.0-beta.8`, upstream main `4b683edacb11955cc4a9b854d6bc5e47c35d6b2a` at test time |
| Native Kora executable SHA-256 | `de109cb7dd7a906f960fa7fb62f50324f1b020d8d187be36bab03cf2169eb7f9` |
| PayBox SDK | `@paybox-sh/sdk` **1.0.0** |
| Transaction builder | `@solana/web3.js` **1.99.0**, `@solana/spl-token` **0.4.15** |
| Surfpool | **1.5.0** |
| Pricing | Test-only Mock oracle: **1 NEIRO = 0.001 SOL**, **5% margin** |

Funds, operator keys and token-account balances were synthetic fork fixtures. All token accounts existed before the successful payment, so **PayBox + NPN account creation remains unproven by this receipt**. The tested transaction was a legacy Solana transaction with two required signatures; other transaction versions, swaps, browser wallet flows and PayBox as an operator signer were not exercised.

The local test environment required extra setup: isolated Kora, controlled test HTTPS, Surfpool and a read-only RPC relay. The relay forwarded mainnet account reads to Solana RPC for the fork; transactions were submitted only to Surfpool. This relay is a test-environment workaround, not an NPN client requirement. No OS certificate trust was changed.

An earlier payment attempt containing recipient ATA creation passed quote and signing, but local preflight failed while fetching missing remote accounts. Its exact signature, history, balances and expired blockhash were reconciled before a fresh transaction was signed with an explicitly seeded recipient ATA. That failed attempt is not counted as account-creation success.

The test listing was closed with finalized confirmation, its absence was checked, and all temporary services were stopped. The in-memory fork was discarded. Mainnet payments, live oracle pricing, production HTTPS and unattended operation remain untested by this run. The successful payment phase took approximately **13.35 seconds**, excluding setup; this is not a production latency guarantee.
