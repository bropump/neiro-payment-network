# Publisher security boundaries

Operator installation uses the [Node.js runner](script/README.md) and unchanged official Kora. Follow [AGENTS.md](../../AGENTS.md) for setup and acceptance checks. The optional [Rust reference](RUST-REFERENCE.md) has an older upstream dependency and different locking; it is not the operator installation path.

## What the runner checks

- The selected signer, expected network, record owner/authority/derived address and supported terms.
- Live Kora identity, payment destination, price/oracle, NEIRO acceptance and the individual listing's deny entry before publication.
- Independent Ed25519 attestation over the exact stored terms, record and network; strict v5 readers reject altered or legacy listings.
- Finalized block anchors: unchanged terms renew after 24 chain hours; participating readers reject them at 48 hours. Host clocks do not determine validity.
- Rent, fee and transaction-size caps before signing; signatures are verified and the send is journaled before broadcast. Unknown outcomes block further signing until resolved.

See the [format and client checks](../../docs/SPL-RECORD-LISTINGS.md) for the exact byte layout and [runner tests](script/) for executable checks.

## What deployment must provide

**Protect every public Kora instance sharing the key.** Deny the individual listing account, restart and test actual signing rejection on each instance. Checking a file or one `getConfig` response cannot establish that every replica enforces it. Keep metrics and signer credentials private. [Setup](../../AGENTS.md#3-protect-the-listing-then-start-kora) · [HTTPS](../../docs/HTTPS.md).

**Use a compatible signer.** Memory signing has integration evidence. Remote adapters have local validation/deadline/error tests, not universal live-provider verification. Check the selected backend's attestation and transaction signatures. Custom signer HTTP configuration and pooled endpoint selection have [documented limitations](../../docs/SIGNING.md#listing-runner-compatibility).

**Keep one worker and durable private state per signer.** Node uses a directory lock that can remain after a crash. Do not delete pending receipts or switch directories to bypass an unresolved send. Even credential-free `check` takes the lock and can reconcile local receipts. Follow [recovery instructions](../../docs/RENEWAL.md#when-a-check-fails). Windows directory-fsync/power-loss durability and Raspberry Pi hardware operation are not established by the recorded tests.

**Verify payments separately.** A signed listing authenticates advertised terms, not honest pricing, continuous uptime, discovery completeness or latest state. Clients need trusted finalized RPC data, safe URL handling, independent quote calculations, exact transaction inspection and confirmation. Landed failed transactions can charge the operator network fees while reimbursement rolls back. [Client / builder flow](../../docs/BUILD-WITH-NEIRO.md).

## Review evidence

The [dated publisher reviews](../../docs/test-results/publisher-reviews-2026-10-07.md) record TypeScript tests, independent review, Surfpool lifecycle tests and earlier mainnet receipts. They identify the versions and scope tested; historical outcomes are not proof of a current deployment. The [feature map](../../docs/FEATURE-MAP.md) records payment coverage separately.

Run the current checks from `tools/kora-publisher/script`:

```sh
npm run typecheck
npm test
npm audit --registry=https://registry.npmjs.org
```

These are engineering checks, not a formal security audit or a guarantee against loss. Locked dependencies and a clean vulnerability scan do not establish that all code is safe.
