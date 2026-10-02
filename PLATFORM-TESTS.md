# Platform test evidence

This record separates host deployment evidence from exact-template payment tests. It describes completed tests, not current service uptime. No new transactions were submitted when preparing this page.

On October 2, 2026, the recommended template changed to `allowed_programs = "All"` and a 0.25 SOL allowance. The payment results below retain their original configurations and do not validate that updated template. Its checks are recorded separately in [config update verification](config-update-verification.json).

## Latest upstream main upgrade — 2 October 2026

Our Mac and Bunny operators now use the official main image at commit `afe5e6b297c33b71293eb57da80bd8de8b40709a`, pinned by digest. Both retained their signer identity and markup and expose `allowed_programs = "All"` with the recommended 0.25 SOL allowance. Genuine transaction-format v1 native fee estimates and NEIRO quotes succeeded on both live endpoints without public-chain submission.

The same unmodified image signed and confirmed six private-ledger transactions: legacy, v0 and v1 with each of Para and memory signers. Both signatures were independently verified and approved message bytes were preserved. V1 signing without submission was also verified with both backends. The disposable validator was Agave 4.2.2. These signing tests used Mock pricing and free sponsorship, not the exact NEIRO settlement preset. [Verification evidence](main-upgrade-verification.json).

Fresh operator installs resolve the latest successfully published official main image. Running operators check for updates every five minutes. The following older tests retain their original release and configuration scope.

## Bunny.net

Recorded September 29, 2026 using the earlier router and registration service. Stock Kora `v2.2.0-beta.8` ran on Bunny Magic Containers. Initial deployment evidence records one France instance, successful operator admission, eligibility, direct quotes and routed quotes. A later live test records two finalized Jupiter swaps through the Bunny router/operator setup, with NEIRO reimbursement and account-creation cost recovery:

Mainnet transaction identifiers are retained in private test records. They are omitted here because publishing them links the test wallets and their on-chain activity. This public summary is therefore a reported result, not independently checkable mainnet proof.

The Bunny test used a 5% operator margin and a broader program policy than the September 30 basic-payment template. It does not validate the October 2 template or the future sponsor-only All configuration. On-chain receipts prove transactions; attribution to the host comes from the deployment/test records. These tests do not establish sustained uptime, capacity or every Bunny region.

Source records: `BUNNY-KORA-TEST.md` and `JUPITER-LIVE-SWAP-REPORT.md` from the existing project test outputs. This summary omits internal endpoints, operational tooling and unrelated wallet information.

## Mac

Recorded September 30, 2026. Apple Silicon, macOS 15.6.1, unchanged upstream Kora `v2.2.0-beta.8`, commit `7aea236d9d24f579e21c578ccf69707246968b23`.

Configuration validation passed. Two NEIRO payments settled on a disposable private ledger: an existing recipient token account and a newly created recipient token account. The customer held zero SOL throughout; sponsor costs and reimbursement were checked.

The template used a 0.01 SOL allowance and 50% margin. Only pricing changed from Jupiter to Mock. These are test values, not operator requirements. The native build was a development build; this is not a production binary distribution or proof of public Mac hosting.

[Configuration, binary hash and payment receipts](preset-payment-evidence.json) · [Validation scope](verification.json)
