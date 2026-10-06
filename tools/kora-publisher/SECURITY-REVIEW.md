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

## Signed listing restoration — 6 October 2026

The publisher now signs an independent, domain-separated Ed25519 attestation over program ID, derived record address, genesis and exact v2 JSON bytes, then signs the normal write transaction. Every create/update uses this format; a matching signed listing is a no-op. Rent/fee/message-size checks precede either signing request. Closing remains available without an attestation and returns rent to the operator.

The shared reference reader rejects unsigned v1, malformed lengths/padding, altered terms, wrong authority/derived address/network, invalid signatures, noncanonical signature scalars, and small-order public keys or R encodings. Public fixtures verify interoperability between the Rust signer and JavaScript reader. This is reference verification tooling, not a deployed frontend or an audit certification. A valid proof authenticates terms; it cannot establish their recency, discovery completeness, balances, endpoint safety or quote honesty.

17 Rust tests and 68 shared JavaScript tests passed for this change. The existing unrelated Surfpool namespace test is not part of the shared GitHub test package and was not rerun for this format change.

Bunny's existing mainnet record was updated in place. Two independent RPC endpoints returned the same finalized transaction and record; the detached payload signature and transaction signature both verified. Fabricated copies with changed URL, fee model and payment destination were rejected. Existing Kora config, NEIRO balances and record rent were unchanged; only 5,000 lamports of network fee were spent. No ATA was created or closed.

Publication: [2CJpjod1LuQahY4TrJQadUm9uCHi4aZmbMewUNSzsz2HJugK5beGAHi653VSD8tuDbpFpUAsjrAm1TJzTqPrJ6NV](https://explorer.solana.com/tx/2CJpjod1LuQahY4TrJQadUm9uCHi4aZmbMewUNSzsz2HJugK5beGAHi653VSD8tuDbpFpUAsjrAm1TJzTqPrJ6NV). Record: `AUcq2QhmqGAH4QSm5qMPnfZb6TcEoKVF8fHGg9FnWKfo`.

## Explicit verification metadata — 6 October 2026

The shared Rust create/update path now emits v3 with signed `sig_alg=ed25519`, `sig_enc=raw64-after-json`, `msg_id=NEIRO069-MSG1` and `signer=operator`. The message continues to bind the exact JSON, record address, program and genesis. The old v2 definition is retained in documentation and a rejection fixture; the v3 verifier does not silently downgrade. A migration test confirms that updating a correctly signed v2 listing produces the same payload and signature as creating a new listing with those terms.

18 Rust tests and 82 JavaScript tests passed across the full Rust suite and the added migration test. Checks include correctly signed unsupported metadata, metadata tampering, signature replay to another address/network, exact stored-byte verification despite JSON formatting differences, and deliberately separate fee-receiving addresses. Key equality is signer/operator/authority; payment is separately signed and checked. This is regression verification by the implementing agent, not an additional independent audit.

Bunny's in-place mainnet migration finalized: [2Y4R5RFddCyuUwHyyXApNCGh5VnGziip1D1LGyxiBF11j6Wp5u66EckEU5noh8uA45WNBSpwebtVBsa5hzREZuaf](https://explorer.solana.com/tx/2Y4R5RFddCyuUwHyyXApNCGh5VnGziip1D1LGyxiBF11j6Wp5u66EckEU5noh8uA45WNBSpwebtVBsa5hzREZuaf). Two RPC endpoints agree on the finalized transaction and account; transaction and detached signatures verify. All existing advertised terms, record authority/rent and Mac/Bunny Kora configs stayed unchanged. Cost: 5,000 lamports, no token movement or ATA changes. A second publish returned “Unchanged; no transaction sent.” The Solana public RPC scan returned one NEIRO069/733-byte record, Bunny's verified v3 listing; this is an observed scan result, not proof of global RPC completeness.
