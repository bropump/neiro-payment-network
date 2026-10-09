# NPN operator configuration

**[Client / builder guide](docs/BUILD-WITH-NEIRO.md)** · **[Agent operator setup](AGENTS.md)**

This page explains the operator template. For installation and required checks, follow [AGENTS.md](AGENTS.md). Use private copies of the Kora and signer templates. Official Kora serves quotes and sponsorship; the Node.js listing runner publishes and renews the operator's signed onchain terms.

## Current recommendation

For broad program compatibility, the [stock Kora template](examples/operator/kora.toml) uses these settings in its existing `[validation]` section:

```toml
[validation]
allowed_programs = "All"
max_allowed_lamports = 250000000 # 0.25 SOL
max_priority_fee_lamports = 100000 # 0.0001 SOL maximum priority fee
```

These are configuration fragments, not complete startup files. Retain the required methods, NEIRO reimbursement mint, chosen pricing, signer configuration and fee-payer policies. The template uses a 50% margin example; each operator chooses its fee. This recommendation does not change an existing operator’s markup. Validate the complete private files with `kora --config /PRIVATE/kora.toml config validate --signers-config /PRIVATE/signers.toml` before restarting.

`All` removes the program-ID allowlist, including for unknown programs and routed venues. It does not make arbitrary programs safe for the sponsor. Stock Kora still applies its other validation and payment checks, but its existing fee-payer permissions do not establish a general arbitrary-program safety boundary. This gap is tracked in [upstream #683](https://github.com/solana-foundation/kora/issues/683).

0.25 SOL is the selected per-transaction lamport allowance, not a daily budget, a universal cost requirement or a guarantee of total loss being capped at that amount. Kora validates estimated network fees separately from modeled fee-payer outflow. Applications must quote the complete transaction, including sponsored rent, and obtain approval for the final payment. See the [upstream validation source inspected on 8 October 2026](https://github.com/solana-foundation/kora/blob/4b683edacb11955cc4a9b854d6bc5e47c35d6b2a/crates/lib/src/validator/transaction_validator.rs); this evidence revision is not an installation pin.

The priority-fee cap is separate from the overall lamport allowance and operator markup. Callers set their priority fee before requesting a quote. `max_priority_fee_lamports = 0` forbids priority fees; leaving the setting unset removes this specific cap. After changing it, restart every Kora instance and verify `getConfig.result.validation_config.max_priority_fee_lamports` and rejection of an above-cap request. The estimate endpoint can still return a quote above this cap; enforcement happens before signing. This is a per-transaction limit, not a daily spending budget.

This recommendation does not claim measured 90% signing success, compatibility with every transaction, or protection against users signing wallet-draining transactions. Application preparation, payer funding, parsers, token policies, signatures and other Kora limits still affect acceptance.


| Setting | Included template |
| --- | --- |
| Kora | Current official upstream main SHA; use a matching image digest or native build |
| Operator reimbursement token | NEIRO, six decimals; application transactions can involve other tokens |
| Operator fee | Operator chooses margin, fixed or free; template example is cost plus 50% |
| Signing methods | `sign_transaction = true` and `sign_and_send_transaction = true` by default |
| Sponsor allowance | Recommended 0.25 SOL per transaction; operator may choose another allowance |
| Priority-fee cap | 100,000 lamports (0.0001 SOL) per transaction; higher requested priority fees are rejected before signing |
| Current program policy | `allowed_programs = "All"` |
| Sponsor permissions | Account creation and SOL transfers enabled; sponsor token spending disabled |

[Kora configuration](examples/operator/kora.toml) · [Signer example](examples/operator/signers.toml)

`signTransaction` returns a signed transaction for the client to submit; `signAndSendTransaction` signs and submits through Kora. Both are part of the NEIRO default and apply the configured validation and payment policies. Existing deployments using the older `sign_transaction = false` preset should set it to `true`, validate their configuration, restart Kora, and check that `getConfig.result.enabled_methods.sign_transaction` is `true`.

Resolve current official upstream main on installation and during the host's five-minute update checks. Verify the image's source SHA matches it; if edge lags, wait for the matching image or build that revision natively. Pin the verified deployment and retain the previous build for rollback. A rollback is out of date, not a successful update. The listing runner does not upgrade Kora. Follow the commands and rollout checks in [AGENTS.md](AGENTS.md).

Fees and spending allowances belong to the operator. The example 50% and recommended 0.25 SOL are not network requirements. Edit a private copy for your settings and check admission after deployment. Raising the allowance alone does not guarantee launches will pass Kora validation.

## Protect the listing and apply changes

Before serving requests, run `node runner.ts protect --operator YOUR_OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml` from `tools/kora-publisher/script`. It derives the operator's listing address and adds it to `validation.disallowed_accounts`. Restart every Kora instance sharing that signer and verify a harmless sign-only request touching the listing is rejected specifically for that account. A file edit alone does not prove protection. The [setup procedure](AGENTS.md#3-protect-the-listing-then-start-kora) includes the checks.

When fees or advertised settings change, validate and restart all Kora instances, then restart the sole renewal worker with the same private config and persistent state. It republishes changed terms when live Kora agrees. Verify discovery and a matching quote; do not wait for the next daily renewal to advertise changed fees. See [operations and recovery](docs/RENEWAL.md).

## Failed transactions and launch costs

A failed, landed transaction still charges the operator its base and priority fees. Its NEIRO reimbursement and account-creation transfers roll back. Putting reimbursement first in the transaction does not change this. Preflight and spending caps reduce exposure; they cannot guarantee zero losses. See [Solana transaction processing](https://solana.com/docs/core/transactions/transaction-pipeline).

`max_allowed_lamports` is checked against network fees and modeled sponsor outflow separately. A rent-heavy launch therefore needs enough allowance for its account creation, even when its network fee is small. Keep the separate `max_priority_fee_lamports` cap to restrict priority fees. Re-quote the complete transaction after changing priority fees, instructions or account-creation requirements. An estimate above a cap may still be returned; Kora rejects it on the signing path.

If the operator requires failed-transaction fees to be covered in advance, that needs a separate funded payment/reservation design. The standard configuration and SPL listing do not implement one. Funding that reserve also has a network-fee payer; NEIRO collateral carries conversion-price risk.

## Prepared recommendation after #683 ships

As checked on **8 October 2026**, [PR #692](https://github.com/solana-foundation/kora/pull/692) is open and is not merged into official main (`4b683edacb11955cc4a9b854d6bc5e47c35d6b2a` at that check). Recheck upstream status during setup. Keep the current configuration until the feature merges and passes compatibility checks in an official main build. A tagged release is not required. Do not patch Kora or assume an unknown TOML field activates the proposed protection.

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
max_priority_fee_lamports = 100000 # 0.0001 SOL maximum priority fee
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

Your host, dedicated signer reference, RPC/Jupiter credentials and intended public HTTPS endpoint. See [operator setup](AGENTS.md) for deriving and protecting the listing, publishing terms and checking direct discovery after changes.

## Pricing service

Stock Kora uses Jupiter for the supplied NEIRO pricing configuration. Keep the Jupiter credential available to Kora. Clients must independently check pricing inputs when verifying quotes; an onchain listing is not a price feed.

The template sets `validation.max_price_staleness_slots = 0`: Kora uses Jupiter prices without rejecting them based on age. Jupiter's NEIRO reference price can remain unchanged between qualifying trades even while swap routes are available. A short age cutoff can therefore block paid quotes. Disabling this cutoff accepts the risk of using an outdated reference price; it does not establish that the price is accurate. Other Kora validation remains enabled.

Operators who require an age cutoff can choose a positive slot limit, accepting that paid quotes may become unavailable. This setting applies to the operator's oracle pricing, not just NEIRO. It is separate from transaction blockhash validity, client quote acceptance and the listing's 48-hour renewal deadline.

When updating an existing deployment, set the value in the existing `[validation]` section of the actual deployed `kora.toml`, restart every affected Kora instance, and verify `getConfig.result.validation_config.max_price_staleness_slots` matches the chosen value (`0` for this template). Keep the listing runner's private config in sync with the deployed config. Verify a paid quote and a bounded payment; do not silently switch to free sponsorship. No SPL Record format change is required. Clients can inspect the live setting and apply their own pricing checks.
