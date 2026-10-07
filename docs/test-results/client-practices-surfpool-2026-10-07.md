# Client integration: Surfpool test results

7 October 2026. [Back to the integration guide](../BUILD-WITH-NEIRO.md).

These checks executed against two isolated, unchanged Kora instances and a Surfpool mainnet fork, using fresh local-only keys, synthetic balances and a deterministic Mock oracle. The signed listing URLs were mapped to loopback test endpoints; this does not test public HTTPS or live Jupiter price quality. It is not a mainnet benchmark. [Machine-readable results](client-practices-surfpool-2026-10-07.json).

- Published, discovered and authenticated two real v5 SPL Record accounts; read operator balances in one RPC batch.
- Independently calculated a classic SPL transfer plus missing recipient ATA: 10,200 lamports network fee (including 200 priority) + 2,039,280 rent. Quotes matched the listed 5% and 10% margins exactly under the fixture price.
- Rejected an overcharge, changed live pricing, wrong payment destination, low client fee cap, stale fixture price, tampered record and changed returned message. The exact 48-hour expiry check used injected trusted context; it was not a 48-hour wall-clock run.
- Live Kora signing rejected a transaction touching its denied listing and a 100,001-lamport priority fee against a 100,000 cap.
- A dead endpoint and a first-arriving invalid quote did not win the verified quote race. Across five controlled rounds, the cheaper operator had an injected 250 ms delay: fastest returned the other verified result without waiting, while cheapest selected the cheaper quote after comparison.
- Submitted the approved sponsored transfer with zero user SOL. Confirmed one token base unit reached the recipient, exact NEIRO reimbursement reached the operator, and the operator paid the independently calculated SOL cost. Rebroadcasting the same signed transaction did not produce a second payment or fee; Surfpool reports it as already processed.
- Returned the recipient’s test token, closed its newly created ATA and returned all 2,039,280 lamports of rent to the sponsor, then closed both listings. These accounts were controlled test fixtures; ordinary clients cannot close someone else’s ATA.

Local measured timings: discovery **106.0 ms**, authentication **3.6 ms**, batched balances **0.4 ms**. Median verified fastest-result delivery **4.9 ms** versus **256.1 ms** waiting for both, with the intentional 250 ms delay included. These values demonstrate return behavior on this local machine, not expected production speed.

The 104 existing reader/quote tests also passed. This run does not establish arbitrary-program cost calculation, browser-wallet compatibility, Jupiter swap execution or Meteora launch compatibility. Earlier launch tests have a separate scope; do not infer those results from this transfer.
