# Rust router alignment

Reviewed September 30, 2026 against the user-supplied Rust source. [Source hashes](router-source-review.json) identify the reviewed files, not a published release. The separate Rust checkout may continue changing; recheck compatibility when its release is selected.

| Setup concern | Current Rust implementation |
| --- | --- |
| Registration | Operator signs a record and publishes a Solana System/Memo transaction with `neiro-router publish` |
| Network identity | Matching genesis hash, namespace and derived or explicit anchor |
| Renewal | Maximum 86,400 seconds; new increasing revision; scheduler operated separately |
| Key custody | Operator signs locally; no sponsor key in gateway |
| Public data | Payer, endpoint, revision and timestamps remain on-chain |
| Provider access | Public HTTPS Kora; no provider credential store |
| Admission | Matching payer, $1 SOL and $1 NEIRO, supported pricing/methods, sponsored account-creation quote |
| Readiness | `/readyz`, then own payer in `/operators`; `/healthz` is only liveness |
| Payments | `/rpc`, payer pinning; Kora validates sponsorship; router does not simulate payments |
| Limits | Legacy and v0 without lookup tables; no sign-only, bundles or transfer convenience API |

The reviewed source's admission requirements are covered by the current All/0.25 SOL template: System, Token and Associated Token programs, at least two signatures, a positive allowance, account creation and the required RPC methods. The template uses supported margin pricing and permits NEIRO reimbursement. This is a source-level compatibility check, not a new registered deployment test.

The source accepts both explicit program lists and `allowed_programs = "All"`. On October 2, 2026, this package changed its recommendation from the six-program basic-payment list to `All` and raised the allowance to 0.25 SOL. The planned `sponsor_only_programs` policy still requires a separate upstream release and compatibility check. See [configuration and upgrade status](../CONFIGURATION.md).

No existing endpoint was opened, no registration or renewal was published and no real payment was sent during this documentation update. Public registry discovery relies on RPC history and its configured scan bound. Spam can exhaust that bound; the implementation does not claim permissionless spam resistance.

Before unattended onboarding is possible, publish a reviewed CLI source/release reference and the intended network profile. This package deliberately contains no internal hostnames, test namespace, production wallet or credentials in place of those inputs.
