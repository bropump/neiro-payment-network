# Account-rent, swap-protection and retry checks

The [reference example](../CLIENT-PAYMENT-CHECKS.md) addresses concrete mistakes found in generated NPN clients. These results establish specific checks and fork payments, not arbitrary-product compatibility or production readiness.

## Account rent: reproduced and rejected

On an isolated Surfpool fork, the tested unchanged Kora build estimated new account rent whenever the draft included the tested idempotent ATA instruction, including for an already-existing ATA. An independent calculation must read actual account state rather than repeat that assumption.

The corrected example rejected this overcharge before customer signing or signature release. A separate existing-ATA control omitted the redundant standalone ATA setup instruction, obtained a fresh quote and completed a NEIRO payment. A separate payment to a genuinely absent ATA also finalized with exact rent reimbursement.

| Case | Operator quote, raw NEIRO | Independent rent, lamports | Result |
|---|---:|---:|---|
| Existing ATA, redundant idempotent creation | 2,151,744 | 0 | Rejected before signing; no signature released. |
| Existing ATA, redundant creation omitted | 10,500 | 0 | Finalized; exact reimbursement. |
| Absent ATA, creation retained | 2,151,744 | 2,039,280 | Finalized; exact reimbursement. |

Both successful payments moved 1 raw NEIRO of principal, paid 10,000 lamports of network fees through Kora, and left the customer at **0 SOL**. The test oracle was **1 NEIRO = 0.001 SOL**, with a **5% margin**. These are synthetic fixture prices.

The earlier diagnostic deliberately broadcast the overcharged transaction on the synthetic fork to measure its actual rent cost. That diagnostic is not presented as a successful guard. The later rejection and two corrected payments are separate cases. [Quotes, signatures and complete corrected-payment receipts](client-payment-checks.json).

## Swap and retry regressions

- The recorded BisonFi/Jupiter instruction was copied unchanged into the regression fixture. Patching its quoted-output amount to 1 or changing a signer account fails the instruction-equality guard. This is a deterministic mutation test; it does not claim a fresh BisonFi swap settled.
- A lost-response test records the exact pending attempt before the release callback, then restarts with the same operation ID. The second attempt stops before preparing or signing a replacement, and the original journal remains unchanged.
- Two competing OS processes sharing an operation ID produce exactly one preparation and one release. The example's permanent operation claim deliberately requires explicit outcome reconciliation; it is not an automatic recovery implementation.
- Existing account tests reject wrong mint/owner/program, frozen/uninitialized data, unsupported sizes and RPC-error-shaped results. Missing or unsafe network-fee inputs reject too.

Run `node --test tools/kora-publisher/client/*.test.mjs` from the repository root. The example complements the full listing, quote, message, signature and receipt checks in the [client guide](../BUILD-WITH-NEIRO.md).

## Product retests after the corrections

A fresh low-reasoning agent using the candidate guide built **two Neutral Trade SOL Bundle `requestDeposit` operations** from its official SDK. Both finalized on the fork. Independent review verified every required signature, the approved message bytes and transaction-local SOL/NEIRO deltas.

| Request | SOL principal | New rent paid by operator | NEIRO reimbursement |
|---|---:|---:|---:|
| First | 1 SOL | 5,992,560 lamports | 6.302688 |
| Repeat | 1 SOL | 0 lamports | 0.010500 |

Both network fees were 10,000 lamports. The existing pending-deposit ATA was not charged again. These are **pending deposit requests**, not proof of keeper processing or issued vault shares. [Full receipts and independent checks](client-product-retests.json).

This was a **guided documentation and infrastructure iteration**, not an unassisted cold pass. The initial run exposed an incorrect new-rent-minimum check on existing accounts; it was removed and regression-tested. A Surfpool submission timed out; its signed journal was preserved. Finalized expiry was established before full-history absence checks on the same complete local fork, then a new attempt was explicitly authorized. Only absent-account cache entries were repaired; product state, balances and price bounds were not changed. One unused synthetic key was accidentally printed during the agent's initial inspection and was retired before signing; the guide now explicitly prohibits dumping wallet JSON.

The Save USDC deposit also finalized after rebuilding `CreateAccountWithSeed` with its official constructor. The receipt shows **0.25 USDC principal**, **12.587568 NEIRO reimbursement**, **11,988,160 lamports of operator outflow** (including the 10,000-lamport network fee), and **no customer SOL decrease**. Required signatures and approved message bytes independently verify. This is transaction compatibility evidence only.

**The generated Save client failed recovery policy.** After a local pre-broadcast coding error, it created a replacement before establishing the outcome of the message already co-signed by Kora. A later successful receipt does not excuse that mistake. It also initially expected receipt tokens in the customer wallet without accounting for the lending operation's collateral destination. Its code is not shipped or approved. The guide now explicitly prohibits retry-suffixed business IDs and treating a local `NOT_SENT` exception as proof once Kora has received a customer signature. The permanent-claim example rejects an existing operation ID; it cannot recognize two arbitrary IDs as the same purchase. These agent trials do not establish that prose alone prevents unsafe generated clients.

A separate agent kept BisonFi's original output protection. The live Jupiter route failed slippage on the fork and was rejected before signing. That is a successful safety check, **not a completed BisonFi swap**.

## Environment

Kora source: `b15b482968518a61f2a55acb7a19b8fb524b9109`; binary SHA-256: `de109cb7dd7a906f960fa7fb62f50324f1b020d8d187be36bab03cf2169eb7f9`. This pinned regression identifies the tested build, not the version operators should install today. The operator setup policy remains latest upstream main.

All funds were synthetic. Local service endpoints used a test CA and private fork state. Production signing, current market pricing, hosted website integration and mainnet execution were not tested here.
