# Additional app compatibility checks

**Metaplex Core asset creation passed on Surfpool with zero customer SOL and exact NEIRO reimbursement.** This is one new verified operation. It does not certify a production client, the hosted Metaplex interface or every Core operation. [Machine-readable evidence](additional-app-compatibility.json).

Two fresh GPT-6 Luna agents on low reasoning used the published NPN client instructions at commit `2a87d166b67645f8814234e559493575eacc50d1`. An independent reviewer checked the receipts, signatures, message bytes, account state and transaction-local balance changes. Their generated clients were **not approved for reuse**.

## Verified operation

| Check | Result |
|---|---|
| Program / instruction | Metaplex Core `createV1` |
| Customer SOL | 0 before and after |
| Customer payment | 3.717378 NEIRO, credited exactly to the operator |
| Operator SOL cost | 3,540,360 lamports: 15,000 network fee plus 3,525,360 asset funding |
| Pricing | Test-only fixed price of 0.001 SOL per NEIRO, with 5% margin |
| Product state | Asset created; customer is owner and update authority |
| Transaction integrity | All three required signatures valid; finalized message matches the approved message |

Asset: `Y7oZYpwLwmCL3agvuXT7ygvuzkkcVZh1eDXZPopEaif`.

Finalized local signature: `2QP2toAoHfAQ3B6LujzQnHnqafEdeAFRXNCfUhcpQ4JVYEHZ9Bz2MgH6LnrG7ZvUaUgxQcJkpgioqxpvf6i7GkZi`, slot `454981959`. This is a local fork receipt, not a mainnet explorer transaction. The asset's funding exceeds its reported rent minimum; do not describe the entire amount as refundable rent.

## Other attempts

| Target | Outcome |
|---|---|
| Core transfer | Simulated and co-signed, but no finalized receipt. Its blockhash expired without observed account effects. The send response was not retained, so RPC admission is unknown. No replacement was issued. |
| Squads v4 | Client safety failure: the generated code sent a partially signed transaction to the quote endpoint before fee verification and durable journaling. The parent stopped the test after the reviewer flagged it. A cost mismatch also rejected preparation. No finalized operation. |
| Legacy Drift USDC collateral | SDK could not decode the deployed account layout. No payment tested. |
| Velocity USDT collateral | Quote, simulation and signatures succeeded. The generated client used an unsupported raw JSON-RPC method, `sendRawTransaction`, and obtained no finalized receipt. The signed attempt expired; no replacement was issued. This is separate from legacy Drift. |
| OpenBook v2 | Modeled account costs did not match the operator quote; stopped before signing. Order placement/cancellation remains unverified. |
| Tensor | The agent did not establish a supported executable path with the available API access and market fixture. No operation tested. |
| Lulo | Required API access was unavailable. No operation tested. |

These outcomes do not establish that the blocked applications are incompatible with NPN. They identify what this particular trial did not prove.

## Client safety findings

- A quote request can release usable signatures if the builder signs internally. Check the serialized transaction, not just the name of the RPC method. Squads' actual outbound bytes were not retained; the preserved source and agent's execution report establish the early-signature path.
- Retain the exact submission response/error and reconcile the saved attempt. A journal label written before sending is not proof of RPC acceptance, and missing history alone is not proof of nonpayment.
- Keep pending signed requests private. The Velocity driver saved executable request/response bytes with mode `0644`; the parent restricted the files to `0600`. Those request bodies are excluded from publication.
- The reviewer found gaps in recovery locking, final pre-sign record refresh, overall preparation deadlines and transaction-local settlement checking. A successful app transaction does not approve those implementations.

The existing [client instructions](../BUILD-WITH-NEIRO.md) and [payment checks](../CLIENT-PAYMENT-CHECKS.md) require these protections. This batch shows that the lower-tier agents did not consistently implement them. It is not evidence of reliable unattended mass testing.

## Environment and assistance

Official Kora source: `cbef22d82ff599e892fd54b6d10af4f6cca4da80`, resolved from upstream main for this trial, unchanged. Native binary SHA-256: `ef24de06694d5626d74c215862fca25264515ba9e99b7fd66cdb276d3e2e0fe9`. Surfpool: `1.5.0`. All balances, customer keys and writes were synthetic and local.

The parent supplied two protected test operators, signed listings, controlled local HTTPS and funded fixtures. The agents performed their own discovery and product construction. The parent also prefetched public Core accounts to avoid a fork lazy-fetch issue and added a missing, actually observed fork slot to the fixed Mock-price metadata. This was independent client implementation with infrastructure assistance, not an unaided installation test. After the reviewer flagged safety issues, the parent stopped Squads and restricted Velocity logs; neither intervention counts as an agent safety pass.

The current-main baseline controls also verified paid transfers to existing and absent ATAs. A redundant idempotent creation instruction still produced an inflated quote for an existing ATA, and the exact checker rejected it before signing. These controls are not additional application passes.

Both test operators and Surfpool were stopped; all eight test ports were confirmed closed. Synthetic private keys, TLS keys and private service logs were removed. Raw evidence and expired operation journals remain restricted locally. Production services and original credential files were untouched.
