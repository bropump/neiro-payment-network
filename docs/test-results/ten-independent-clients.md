# Ten independent client trials

**All ten agents built working clients: 20/20 payments finalized, with every customer holding zero SOL.** Independent source review also found mistakes that prevent treating all ten implementations as secure production examples.

The client guide now includes [explicit signature-release, selection and recovery requirements and failure-path checks](../BUILD-WITH-NEIRO.md#test-your-client-before-use). This is a documentation correction; these ten historical clients have not been repaired or rerun against it.

## Review findings

- **High — extra payment authority in rejection probes (01, 04, 07).** These clients customer-signed transactions containing principal and reimbursement transfers, then sent them to `signTransaction` expecting rejection. A malicious operator could co-sign and broadcast them. Kora rejected them in this fixture; independently checked receipts show no extra payments. A sign-only request does not prevent a server broadcasting. Use unsigned or explicitly authorized non-spending probes.
- **Medium — incomplete deadlines (all ten).** Per-request timeouts did not enforce an overall selection deadline. Most transports bounded socket inactivity rather than total response time. A slow endpoint could delay completion despite another valid quote.
- **Medium — false-positive rejection helper (04).** An offline reproduction showed a wrong error, such as a timeout, being counted as PASS. The stored live error was the expected disallowed-account rejection, but the helper is not reliable for future tests.
- **Medium — pending-journal recovery (10).** A restart before the first receipt could overwrite the recorded signed transaction before reconciliation. This is a source finding; no additional payment or crash campaign was run.
- **Low — fastest measurement versus delivery (01, 02, 05, 10).** These clients recorded the first verified quote promptly but waited for other candidates before payment. Client 10 waited before returning from selection itself. Their early log timestamps do not establish immediate caller delivery.
- **Low — discovery availability (01, 07).** One malformed or expired listing could abort discovery instead of being rejected individually.

The generated clients were left unchanged during review. This report does not distribute them as a reusable SDK or certified test suite.

## What each agent achieved

Each client discovered and authenticated signed listings through RPC, compared the live operator configuration, independently checked reimbursement, simulated, verified transaction messages and signatures, submitted and checked the result. Each sent **1 NEIRO twice**: first to a new recipient ATA, then to the existing account. Operators paid network fees and required ATA rent in SOL; customers reimbursed only in NEIRO.

| Agent | Finalized payments | Customer before/after | New-ATA reimbursement (NEIRO) | Existing-ATA reimbursement (NEIRO) |
|---|---|---|---|---|
| 01 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 02 | 2/2 | 0 SOL | 2.459256 | 0.010605 |
| 03 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 04 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 05 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 06 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 07 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 08 | 2/2 | 0 SOL | 2.459256 | 0.010605 |
| 09 | 2/2 | 0 SOL | 2.459376 | 0.010710 |
| 10 | 2/2 | 0 SOL | 2.459376 | 0.010710 |

Charges exclude the 1 NEIRO principal per payment. These are **synthetic test prices**, not current production quotes. Two clients used slightly different priority fees, accounting for the small difference in reimbursement. The first selection used the faster 20% operator; the second compared valid quotes and selected the cheaper 5% operator.

## How independence was tested

Ten fresh agents received the GitHub repository pinned at [`0aa50d6`](https://github.com/bropump/neiro-payment-network/tree/0aa50d6e70339afa03ddcff87b551bf6f097782b), an isolated synthetic customer wallet and explicit acceptance criteria. They had no conversation history, were instructed not to inspect other agents' solutions and received no implementation help. Separate workspaces were used, but filesystem isolation was not enforced. Three ran concurrently. All used the same inherited model; this is not a comparison of ten model families.

The parent supplied two running official Kora services, signed listings and one Surfpool fork. Thus the result tests **client onboarding with prepared infrastructure**, not independent operator installation. The agents wrote their own client code and could use the repository's existing verification functions. All ten public-source clones remained unchanged at the pinned revision.

The fixture used Surfpool 1.5.0, local Ed25519 keys, margin pricing and a constant independent price of **1 NEIRO = 0.001 SOL**. The Kora binary identified itself as 2.2.0-beta.8; its exact hash is in the evidence. This identifies the tested binary, not the latest upstream installation target. The cheaper operator had an artificial 500 ms delay on each quote response.

## Checks and timing

The parent and a separate reviewer fetched all 20 finalized receipts independently. Checks covered valid Ed25519 signatures, the expected operator fee payer, exactly 1 NEIRO reaching each recipient per payment, zero customer SOL, operator SOL outflow and exact NEIRO reimbursement under each 5 NEIRO cap. Each customer had exactly two successful transactions.

Existing listing/quote verifier unit tests also passed: **104 passed, 0 failed**. These unit tests are separate from the 20 payment receipts. Negative-test coverage varied by client and is not an all-checks PASS.

Client stage clocks used monotonic measurements. First-verified-quote events were roughly **29–133 ms**, and cheapest comparison events roughly **1.02–1.55 s**, with discovery already completed and the artificial delay enabled. Four clients waited after the early event as described above. These figures are local fixture measurements, not internet/mainnet latency, and do not measure total document-reading or setup time.

[Machine-readable evidence](ten-independent-clients.json) contains public signatures, slots, balance deltas, source hashes and independent review checks. These signatures belong to the **local fork**, not mainnet explorer transactions. Full source, reports and receipts were retained locally. Test services were stopped, eight test ports checked closed, disposable keys removed and the in-memory fork discarded. No mainnet funds were used.

## Verdict and smallest next improvement

**APPROVE WITH NOTES for the 20 successful NEIRO-paid payments. REQUEST CHANGES before reusing the generated clients as production implementations.**

The docs are sufficient for these agents to reach working transfers, but prose alone did not reliably produce safe negative probes, hard deadlines or recovery. The smallest useful addition is one tested complete payment example covering the provisional quote, reimbursement insertion, exact completed quote check, safe probes, immediate fastest return, an absolute deadline and durable pending-payment recovery. It needs fault-injection tests for those boundaries; it does not require an SDK.

This trial does not establish arbitrary-app compatibility, hosted-wallet support, live oracle correctness, public HTTPS deployment, or 100% security coverage. Those need their own scoped tests.
