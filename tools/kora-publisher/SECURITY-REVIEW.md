# Independent publisher security review

Verdict: **APPROVE WITH NOTES** for bounded Mac/Bunny mainnet testing. This is an evidence-based source review, not a security audit or a guarantee against loss. The completed standalone mainnet evidence was subsequently independently verified as described below.

## Findings

- **Resolved before live test:** the original live gate did not verify operator membership, fee-token acceptance or payment destination. `guard::verify_live` now checks each, and independent mismatch tests pass.
- **Resolved:** journal file and parent directory are synced before send; existing journals cannot be overwritten.
- **Operational requirement:** every public instance using the key must deny this listing. One `getConfig` response cannot prove that all replicas are protected or that configuration will remain unchanged. The live harness must also test actual public signing rejection.
- **Compatibility:** `getPayerSigner` must select the requested operator; hardware envelope-signing and modifying/sending-only backend compatibility is not established. These conditions fail closed and are documented.
- **Separate client boundary:** HTTPS syntax is checked, but publication is an operator declaration, not proof of economic honesty. Client discovery URL security, spam handling, RPC trust, oracle freshness, exact quote and transaction checks are still required.

## Tests run

Independent `cargo test --test review` against the pinned pristine upstream export: **4 passed**, no failures or ignored tests. Tests reject mismatched/missing live terms, verify custom payment handling and paid-token `All`, inspect prefunding recovery+creation as one atomic one-signer message, and check update/close instruction scope and rent destination. They use generated test identities and mocked RPC; no live credentials or transactions. Parent separately reports all 10 tests passed with the actual pinned Git dependency after journal hardening.

Inspected current package files, historical patched CLI diff/status, pinned upstream config/RPC/validator source, Keychain signer traits, and README. Historical diff whitespace checks passed. This workspace is not itself a Git repository; there is no standalone package diff against a prior commit.

## Drift check

The new package is a standalone command with no patched running Kora CLI/server. It directly receives configuration/signer rather than using Kora global state. It retains safety checks rather than chasing a line target: about 124 core + 36 guard + 132 CLI lines at review, with substantial existing upstream dependencies. Do not call the complete executable sub-100 lines, a dynamically installable Kora plugin, or universally secure.

## Next steps

Verify new mainnet lifecycle and public signing rejection receipts, client discovery/quote behavior, cleanup and net fees independently before claiming the live run complete.

## Independent mainnet evidence follow-up

`node outputs/standalone-publisher-live-20261006/independent-recheck.mjs --final` passed after cleanup. The reviewer made only read-only RPC calls, using no private keys or signing functions. Solana public RPC and publicnode both confirm all **10** distinct transactions finalized successfully and agree on transaction bytes, slots, fees and balances. The decoded payment/refund messages match the exact approved/signed message files.

- **60,000 lamports** permanent network fees: Mac 35,000; Bunny 25,000.
- **8,747,760 lamports** deposited in the two listings and fully returned. Both listing accounts absent at finalized commitment.
- Both NEIRO balances exactly restored; existing token accounts preserved; no ATA program or inner account creation in these transactions. No unexplained wallet SOL changes.
- Mainnet writes independently decode as Mac 1% → 2% → 1%, Bunny 5%, expected endpoint/payment/mint. Client evidence rejects the stale price mismatch before signing.
- Public attack probes: **9 exercised account-deny rejections** and **15 disabled-method HTTP 405 rejections**. These should not be described as 24 active validator checks. Both underpayment probes rejected.
- Both final payment quotes match independent calculations from recorded oracle samples exactly. Mac's token-price sample was stale and accepted with a fresh same-Jupiter swap-bound check at 5%; Bunny's token-price sample was fresh. This is not independent-oracle agreement.

Verdict remains **APPROVE WITH NOTES** for the tested flow. Evidence does not establish future operator honesty, uniform guard configuration across unobserved replicas, price-source independence or universal protection against losses.

Detailed evidence: `outputs/standalone-publisher-live-20261006/independent-mainnet-review.json`; fresh raw RPC reads: `independent-mainnet-rpc.json`.
