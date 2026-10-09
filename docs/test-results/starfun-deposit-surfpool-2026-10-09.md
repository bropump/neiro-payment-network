# star.fun presale deposit with NPN — Surfpool, 9 October 2026

Historical test evidence for the versions and environment below. For current instructions, use the [client / builder guide](../BUILD-WITH-NEIRO.md) or [operator setup](../../AGENTS.md).

**Structural pass (Kora flow not exercised):** a buyer holding USDC + NEIRO at **zero SOL** deposited 25 USDC into the live PARASOL star.fun presale vault on a local mainnet fork. The operator was fee payer, funded the new depositor record's rent, and received a 10 NEIRO reimbursement in the same transaction. The buyer finished at zero SOL. The operator here was a local keypair co-signing the NPN shape — no Kora `getConfig` / `estimateTransactionFee` / `signTransaction` round-trip was performed, and the reimbursement was a flat test value, not a verified margin quote. Do not read this as the full Kora-flow pass used in the other client verifications.

The vault program already supports the NPN shape: its `deposit` takes the depositor authority and a separate rent payer (observed on mainnet where the maker funded a depositor's record), so no program change or special instruction is needed — only fee-payer substitution plus the reimbursement leg.

## Tested transaction sequence

1. Forked mainnet in Surfpool. The PARASOL window on mainnet is closed and Surfpool refuses backward time travel, so **only the vault's start/end u64s** (offsets 145/153, located by matching the indexer's known values) were rewritten to surround the fork clock. All other vault bytes, the program, and the deposit flow are untouched. The maker's fee ATA was topped up to rent-exempt (fork drift: 1,488,440 lamports); its data was preserved.
2. Funded a fresh operator with SOL. Fabricated a fresh zero-SOL buyer's USDC (100) and NEIRO (50) balances; in production the buyer brings these.
3. Built the deposit from the decoded mainnet shape (discriminator `f223c68952e1f2b6` + u64 amount), with the operator as fee payer and rent payer, the buyer as depositor authority: compute-budget limit; operator-funded operator-NEIRO-ATA creation; vault `deposit` (buyer 25 USDC → vault, 1% platform fee to the maker); buyer-signed 10 NEIRO reimbursement to the operator.
4. Simulated (success, `Deposit credited: gross=25000000, net=24750000`), signed with buyer + operator, submitted, confirmed. Verified finalized balances, the new depositor record, and the buyer's zero SOL.

A 5 USDC attempt failed `DepositTooSmall` (6034); 25 USDC landed. An unpatched-window attempt failed `RaisePeriodEnded` (6003). Both failures were simulations and were not broadcast.

## Measured costs

These are **test values** on a local fork with a flat 10 NEIRO reimbursement. They are not a Kora margin quote and not current mainnet pricing.

| Item | Operator SOL cost (lamports) | NEIRO paid | Buyer SOL before → after |
| --- | ---: | ---: | --- |
| Deposit 25 USDC + create operator NEIRO ATA + 10 NEIRO reimbursement | 1,652,560: 1,642,560 depositor-record rent + ~10,000 network fee | 10.000000 | 0 → 0 |

Buyer USDC 100 → 75; vault USDC +24,750,000 net; maker fee ATA +250,000 (exactly 1% of 25 USDC, atop 41,750 mainnet dust); buyer NEIRO 50 → 40; operator NEIRO 0 → 10. The depositor record holds 1,642,560 lamports over 108 bytes, owned by the vault program. The operator's actual SOL debit and both wallets' NEIRO deltas matched the built transaction exactly.

## Reverse-engineered reference (for client builders)

Vault program `DJBVrVcy98wCaL4W3Ri4YmBvSXyD5nRAbR7igAMcTRQA`; PARASOL vault `4eRCqBQo2ghDMNxtfyNQ4YTbCd8i7grGwqSMMzxXvZQw`, quote USDC (6 decimals). Verified against two mainnet deposits plus Anchor error names surfaced during probing:

- `deposit` accounts: `[0]` depositor authority (signer), `[1]` rent payer (signer — may be the operator), vault (writable), quote mint, depositor quote ATA (writable), vault quote ATA (writable), `platform_fee_ata` (maker USDC ATA, writable, rent-exempt checked), maker, program ×2, `["depositor", vault, user]` PDA (writable, 108 bytes), `["blacklist", vault, user]` PDA (absent = clean), system, ATA, token programs.
- Inner CPIs: system `CreateAccount` for the depositor record (from = `[1]`), token transfer depositor → vault, token transfer vault → platform fee ATA.
- Window and minimum are enforced on deposits (`RaisePeriodEnded` 6003, `DepositTooSmall` 6034); post-window withdrawals were observed succeeding on mainnet, so each operation needs its own check.
- Quote mint is per-vault: 41 observed vaults use USDC, 14 test vaults use an unnamed mock mint. Read `quote_mint` per vault; do not hardcode USDC. The deposit capital must arrive as the quote token — the operator can advance it (as in the pump-buy SOL advance) but that advance, like the rent, must be priced into the verified NEIRO charge.

## Checks and cleanup

- Wrong `[11]` values fail `ConstraintSeeds` naming `blacklist_entry`; the derived PDA for a clean user does not exist on-chain and that is the expected state.
- The completed transaction's program log, token deltas, record creation, and reimbursement were reconciled against the simulation before submission; the message was signed by both parties unchanged.
- Fixture balances and the window patch existed only on the discarded local fork. No mainnet account or funds were changed. Hosted-wallet compatibility is not claimed by this local-keypair test.

## Reproduction scope and evidence

Versions: Surfpool **1.5.0**, Node **24.3.0**, `@solana/web3.js@1`, `@solana/spl-token@0.4`. Vault and maker programs were not patched. Fresh local keys and synthetic buyer balances were used. Fork base slot 454811443; landed signature `4Pf7kz9mGk5bD77dSaFdMwbFBHETZiy4Cy6uoKzr5hYZ1YfxMqNcwnpSRwukNrffgmLFfBsbXzkdsaeTybMT5Jwh` belongs to the local fork, not mainnet.

To reproduce, fork mainnet, open the vault window as above, fund an operator, give a fresh zero-SOL buyer quote tokens + NEIRO, build the 15-account `deposit` with the operator at `[1]` and as fee payer, append the reimbursement, simulate, dual-sign, and require finalized receipts plus the balance assertions above. Then repeat through Kora's quote/sign flow before claiming the full operator pass.

Known fork-tooling quirk: Surfpool 1.5.0's send path fatally fails its remote fetch for any transaction account missing from local state (simulation is unaffected). Pre-register 0-lamport placeholders for the not-yet-created PDAs; this matches on-chain semantics (uninitialized record slot, Anchor `None` for the absent blacklist entry) and was verified by the landed result.
