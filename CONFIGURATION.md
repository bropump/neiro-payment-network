# NEIRO configuration

This repository owns the Kora operator template and recommendation. Use a private copy of the templates and the [registration guide](docs/REGISTRATION.md). Kora and the listing publisher are separate executables; clients discover operators onchain.

## Current recommendation

For broad program compatibility, the [stock Kora template](examples/operator/kora.toml) uses these settings in its existing `[validation]` section:

```toml
[validation]
allowed_programs = "All"
max_allowed_lamports = 250000000 # 0.25 SOL
```

These are configuration fragments, not complete startup files. Retain the required methods, NEIRO reimbursement mint, chosen pricing, signer configuration and fee-payer policies. The template uses a 50% margin example; each operator chooses its fee. This recommendation does not change an existing operator’s markup. Validate the complete file with `kora --config kora.toml config validate` before restarting.

`All` removes the program-ID allowlist, including for unknown programs and routed venues. It does not make arbitrary programs safe for the sponsor. Stock Kora still applies its other validation and payment checks, but its existing fee-payer permissions do not establish a general arbitrary-program safety boundary. This gap is tracked in [upstream #683](https://github.com/solana-foundation/kora/issues/683).

0.25 SOL is the selected per-transaction lamport allowance, not a daily budget, a universal cost requirement or a guarantee of total loss being capped at that amount. Kora validates estimated network fees separately from modeled fee-payer outflow. Applications must quote the complete transaction, including sponsored rent, and obtain approval for the final payment. See [upstream fee calculation](https://github.com/solana-foundation/kora/blob/v2.2.0-beta.8/crates/lib/src/transaction/versioned_transaction.rs).

This recommendation does not claim measured 90% signing success, compatibility with every transaction, or protection against users signing wallet-draining transactions. Application preparation, payer funding, parsers, token policies, signatures and other Kora limits still affect acceptance.


| Setting | Included template |
| --- | --- |
| Kora | Latest successfully published official upstream main build; resolve on install/update and pin its digest |
| Operator reimbursement token | NEIRO, six decimals; application transactions can involve other tokens |
| Operator fee | Operator chooses margin, fixed or free; template example is cost plus 50% |
| Signing methods | `sign_transaction = true` and `sign_and_send_transaction = true` by default |
| Sponsor allowance | Recommended 0.25 SOL per transaction; operator may choose another allowance |
| Current program policy | `allowed_programs = "All"` |
| Sponsor permissions | Account creation and reimbursed launch-funding SOL transfers enabled; sponsor token spending disabled |

[Kora configuration](examples/operator/kora.toml) · [Signer example](examples/operator/signers.toml)

`signTransaction` returns a signed transaction for the client to submit; `signAndSendTransaction` signs and submits through Kora. Both are part of the NEIRO default and apply the configured validation and payment policies. Existing deployments using the older `sign_transaction = false` preset should set it to `true`, validate their configuration, restart Kora, and check that `getConfig.result.enabled_methods.sign_transaction` is `true`.

Operators follow the latest successfully built official upstream main revision and pin each deployment. Use upstream Kora and your host's update tools; there is no NEIRO software package to install. Retain the previous build for rollback. Kora and its SDK remain unchanged. See [setup and updates](docs/JOIN.md).

Fees and spending allowances belong to the operator. The example 50% and recommended 0.25 SOL are not network requirements. Edit a private copy for your settings and check admission after deployment. Raising the allowance alone does not guarantee launches will pass Kora validation.

## Prepared recommendation after #683 ships

As checked on 2 October 2026, [PR #692](https://github.com/solana-foundation/kora/pull/692) is open and is not merged into official main. Keep the current configuration until it merges and passes compatibility checks in a published main image. A tagged release is not required. Do not patch Kora or assume an unknown TOML field activates the proposed protection.

After the feature ships, replace the current program setting with the following fragment and retain the 0.25 SOL allowance:

```toml
[validation]
allowed_programs = [
    "11111111111111111111111111111111",             # System
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  # SPL Token
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",  # Token-2022
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", # Associated Token
    "ComputeBudget111111111111111111111111111111",  # Compute Budget
    "AddressLookupTab1e1111111111111111111111111",   # Address Lookup Table
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  # Jupiter v6
]
sponsor_only_programs = "All"
max_allowed_lamports = 250000000 # 0.25 SOL
```

Under the proposal, arbitrary outer and inner program IDs can run, but an unapproved program's top-level instruction cannot include Kora's fee-payer account. Jupiter stays in the trusted list because an observed sponsored Jupiter build includes the sponsor in the Jupiter instruction. The trusted list is therefore a list of programs allowed to receive the sponsor account, rather than an inventory of every routed venue. Keep the existing role-specific fee-payer policies as well.

Do not leave `allowed_programs = "All"` in the migrated configuration: the proposal explicitly leaves the sponsor-participation gate disabled in that mode. Sponsor-funded app-owned account creation or other sponsor participation can require additional reviewed programs. Trust in an approved outer program includes its handling of downstream calls; this is not an audit of every routed venue.

Before activation, resolve and pin an official merged main image supporting the setting, confirm its final semantics, update the canonical config hashes, verify direct quotes and listing-account protection, and test representative payments, swaps and launches plus refusal of prohibited sponsor participation. Publish the verified upstream commit and image digest with the updated recommendation.

## Checked application paths

Five unsigned Jupiter builds passed the proposed static participation check with the six core programs plus Jupiter trusted. The returned routes included Meteora DLMM, GoonFi V2, Raydium, Manifest, Raydium CLMM, Whirlpool, JupLend AMM and Kipseli. These checks examined returned instruction accounts; they were not signed, submitted or tested for complete Kora acceptance. Jupiter supports an integrator payer, and its sponsored `/order` flow routes through Metis. [Jupiter gasless documentation](https://developers.jup.ag/docs/swap/advanced/gasless).

GUM Universal Deposit's ordinary sender transaction uses core SOL/SPL transfer and token-account instructions. Its current hosted widget requires the connected user to be the transaction fee payer, so changing Kora config alone does not make that widget gasless. GUM's separate bank, inbox and outbox processing is not part of the ordinary sender deposit. [GUM wallet-deposit documentation](https://docs.gum.ag/universal-deposit/embed).

Token-2022 metadata reconstruction from [cbef6ec](https://github.com/solana-foundation/kora/commit/cbef6ecbc40d753f66480d9cb286f6052f5637d0) is included in the merged upstream main commit `d5a7e64b9e5603cfea5d4c5196553a60f19f9f7e`. The template enables `validation.token_2022.allow_token_metadata_instructions` and `validation.fee_payer_policy.system.allow_transfer` for launch metadata and payer-funded rent/setup transfers. NEIRO payment validation and configured spending allowances still apply. These flags do not restrict System transfers exclusively to rent. Preserve operator fees and all other payer permissions when migrating an existing config. The separate #683 protection is not enabled by this metadata change.

Build and config must be updated together: an old binary still cannot reconstruct these CPIs, and an image upgrade alone does not turn on metadata in a private config. The local Surfpool matrix covers DBC classic/Token-2022, Raydium LaunchLab, Stonkfun standard and 1%/3% rewards, and normal Pump create_v2. It does not certify hosted websites, other modes, live pricing or arbitrary-program security.

## What you supply

Your host, dedicated signer reference, RPC/Jupiter credentials and intended public HTTPS endpoint. See [publication](docs/REGISTRATION.md) for deriving and protecting the listing, publishing terms and checking direct discovery after changes.

## Pricing service

Stock Kora uses Jupiter for the supplied NEIRO pricing configuration. Keep the Jupiter credential available to Kora. Clients must independently check pricing inputs when verifying quotes; an onchain listing is not a price feed.

The template sets `validation.max_price_staleness_slots = 150`. Kora rejects oracle prices older than this slot limit, or prices without the slot information needed to check freshness. This is approximately 30 seconds at 200 ms per slot (37.5 seconds at 250 ms); it does not reserve a quote for that duration or guarantee against price moves. `0` disables the protection. A newly requested quote can still use stale upstream data, so clients should retry only a bounded number of times or select another operator, then report fresh pricing unavailable. Illiquid tokens can remain unavailable under this policy; do not silently disable the guard to make quotes pass.

Apply this setting in the existing `[validation]` section, restart Kora, and verify `getConfig.result.validation_config.max_price_staleness_slots` is `150`. This operator-side protection does not require an SPL Record change: the listing advertises fee terms, while Kora enforces its price-age limit. Clients can inspect the live setting and independently enforce their own freshness limit.
