# NEIRO configuration

Use a private copy of the templates and the [Rust registration guide](docs/REGISTRATION.md). Kora runs separately from the router.

## Intended program default

Once an official Kora release includes [upstream #692](https://github.com/solana-foundation/kora/pull/692), the NEIRO preset should use:

```toml
sponsor_only_programs = "All"
```

This allows application programs without listing each one, provided they do not receive the sponsor account. Keep `allowed_programs` as an explicit list of programs permitted to receive that account; setting that field to `"All"` would disable this participation restriction. Operator fees and spending allowances remain operator choices. Broad program permission does not guarantee every application transaction will pass Kora validation or fit the chosen allowance.

This is the intended next default, pending upstream release and validation. As of September 30, 2026, the PR is open and the pinned beta.8 template below does not support this setting. Before enabling it, update the release pin and template together, verify router admission accepts the new policy, and test representative payments, swaps and launches plus rejection of prohibited sponsor participation.

## Currently verified template

| Setting | Included template |
| --- | --- |
| Kora | Official `v2.2.0-beta.8`, with an immutable image reference |
| Operator reimbursement token | NEIRO, six decimals; application transactions can involve other tokens |
| Operator fee | Operator chooses margin, fixed or free; template example is cost plus 50% |
| Sponsor allowance | Operator chooses the limit; template example is 0.01 SOL per transaction |
| Sponsorship | Transaction fees and new token-account rent |
| Current beta.8 programs | System, classic Token, ATA, Compute Budget, lookup tables and Memo; intended next default is sponsor-only `All` above |
| Sponsor permissions | Account creation enabled; direct SOL transfers and sponsor token spending disabled |

[Kora configuration](examples/operator/kora.toml) · [Signer example](examples/operator/signers.toml) · [Upstream release lock](examples/operator/kora-release.json)

Fees and spending allowances belong to the operator. The example 50% and 0.01 SOL are not network requirements. Your chosen configuration must still pass Kora validation and the network's admission checks. Edit a private copy of the template for your settings. The allowance determines which transaction costs your operator can sponsor; it is not a daily budget.

The included program list covers basic payments. Token launches can require a larger operator-chosen allowance, additional program permissions and support in Kora. Raising the allowance alone does not enable launches.

## What you supply

Your host, dedicated key reference, RPC/Jupiter credentials, intended public HTTPS endpoint and agreed Rust registry settings. The current router uses public providers without a credential store. See [registration](docs/REGISTRATION.md) for publication, renewal and eligibility checks.

## How we keep this reproducible

The preset names one tested Kora version and locks the official Docker image by digest. Agents use that version. A new upstream release becomes the recommended version after a reviewed update to the lock and compatibility checks.

The compatibility workflow checks the canonical template and validates it with the official image, offline, using a disposable test key. It does not enforce the template's example fee or allowance on operators. Release acceptance also requires private-ledger payments using the template permissions and recorded test settings. Each deployment must separately verify its chosen settings, live pricing, credentials, funding, HTTPS and eligibility.

Kora's validator also reports policy warnings, including account-creation sponsorship, Memo parser coverage and the absence of authentication in this public-endpoint profile. The agent should explain the upstream warnings for the operator's chosen configuration. Passing validation is not a security certification.

Two recorded basic NEIRO payments settled on a private ledger with unchanged Kora: an existing recipient token account and a newly created recipient account. These tests used the template's example 0.01 SOL allowance and 50% margin; only Jupiter pricing changed to Mock pricing for the local test. These numbers describe the test configuration, not required operator settings. Live Jupiter pricing and a public operator deployment remain separate checks.

We can make installation repeatable and failures diagnosable. Availability still depends on your host, RPC, pricing service and wallet funding.

## Pricing service

The router already uses `price.neiropay.app` for operator holding valuation. The service returns NEIRO and SOL prices, but the pinned Kora beta.8 supports only Jupiter and Mock pricing and fixes the Jupiter API URL in its code. A custom price URL cannot replace Jupiter through configuration in this version. Keep Jupiter credentials for the current stock-Kora setup; using the NEIRO service inside Kora requires upstream integration or a code change.
