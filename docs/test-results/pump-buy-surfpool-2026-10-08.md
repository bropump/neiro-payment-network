# Pump.fun buy with NPN — Surfpool, 8 October 2026

**Passed:** a buyer with NEIRO and **zero SOL** initialized its pump buyer account and bought 1,000 tokens from a fresh pump.fun bonding curve. Both transactions finalized on a local mainnet fork through unchanged Kora. The buyer paid NEIRO, retained the purchased tokens and finished each transaction at zero SOL.

The earlier statement that the buyer must supply about 0.0018 SOL for its first pump account was too broad. Pump's `init_user_volume_accumulator` accepts a separate `payer`. We tested the operator paying that rent while preserving the buyer as `user`. The [official pump interface](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json) defines those separate roles.

This test also explicitly advanced the purchase funding from the operator. Setting the transaction fee payer alone does not perform that advance. A client must build it, an operator must allow it, and the verified NEIRO charge must cover it.

## Tested transaction sequence

1. Discover the operator through `getProgramAccounts` filtered for `NEIRO069`. Verify its v5 signature, record/network binding and chain-based validity; match `getConfig` to its signed 5% margin and Mock oracle. The signed test URL `https://a.example/` was explicitly mapped to localhost; this did not test public HTTPS availability.
2. Submit `initUserVolumeAccumulator({payer: operator, user: buyer})` with the operator as network fee payer and a NEIRO reimbursement signed by the buyer. The buyer remains the pump account's user.
3. Build the buy with these instructions, before collecting signatures: operator-to-buyer SOL advance; operator-funded buyer token ATA creation; pump `buy` with the buyer as authority and recipient; NEIRO reimbursement to the operator. Compute-budget instructions precede them.
4. Simulate the actual instructions to measure required funding. For this fresh curve, the buy needed 28,310 lamports of purchase principal and 890,880 lamports to initialize another pump account (the creator vault): a 919,190-lamport advance. Do not hardcode these values for other buys.
5. Independently measure the operator's SOL outflow, check the complete transaction's Kora quote against the signed margin and test oracle, replace the provisional reimbursement and re-quote. Require an exact match; no fee tolerance was introduced.
6. Buyer signs; Kora's `signTransaction` validates and signs. Verify unchanged message bytes and every signature, journal the expected signature before submission, send through Solana RPC, then reconcile finalized balance changes.

A control simulation without the purchase advance failed with insufficient SOL. That failure was not broadcast. The succeeding buyer was the original zero-SOL wallet, not the operator substituted as buyer.

## Measured costs

These are **test prices**, using Mock NEIRO pricing of 0.001 SOL per NEIRO and a 5% operator margin. They are not current mainnet NEIRO quotes.

| Transaction | Operator SOL cost (lamports) | NEIRO paid | Buyer SOL before → after |
| --- | ---: | ---: | --- |
| Initialize buyer volume account | 1,854,400: 1,844,400 rent + 10,000 network fee | 1.947120 | 0 → 0 |
| Buy and create buyer token ATA | 3,003,270: 919,190 advance + 2,074,080 ATA rent + 10,000 network fee | 3.153434 | 0 → 0 |
| Total | 4,857,670 | 5.100554 | 0 → 0 |

The buyer received 1,000,000,000 raw units of the six-decimal test token (1,000 tokens). The operator's actual SOL debit and both wallets' NEIRO deltas matched the independently verified charges. The completed quote matched exactly in both operations.

Kora sign-request-to-finalized-receipt observations were approximately 34 ms and 21 ms on this local fork. These exclude discovery, fixture setup and quoting; Surfpool finality is not a mainnet latency measurement.

## Checks and cleanup

- Underpaying for another buyer-account initialization was rejected by Kora before broadcast; wallet balances did not change.
- Changing the blockhash of the successful signed buy invalidated the operator signature.
- The disposable purchased tokens were burned with the buyer's signature. Closing the buyer token ATA and volume account returned **3,918,480 lamports** to the operator; both accounts were absent at finalized commitment. The buyer finished at zero SOL.
- The test listing was closed and independently confirmed absent. Cleanup used the separate fixture creator to pay its buyer-account cleanup fee; cleanup was not another NPN reimbursement test.
- The temporary Kora and Surfpool services were stopped. Fixture mint, curve and creator-vault state existed only on the discarded local fork. No mainnet account or funds were changed.

The operator's `allow_transfer` and `allow_create_account` were enabled, as in the repository template. Token payer-authority restrictions remained enabled. This demonstrates the specific successful and rejected paths above, not a general guarantee against operator loss on failed execution.

## Reproduction scope and evidence

Versions: Surfpool **1.5.0**, Node **24.3.0**, pump SDK **2.0.0**, official Kora image digest `sha256:fc465ca4fc97f317f1cdb857dde382ff0ad306af81d287d7805bba67ca35c247`. Kora and pump programs were not patched. Fresh local keys and synthetic balances were used. A separately funded fixture creator launched the curve before the buyer test; that launch was fixture setup, not part of the claimed NPN buy.

To reproduce, fork mainnet in Surfpool, fund a fresh operator and fixture creator, give a fresh buyer NEIRO with **0 SOL**, publish a local signed listing and create a disposable pump curve. Follow the transaction sequence above using the builder methods `initUserVolumeAccumulator` and `buyInstruction`, standard ATA instructions and a standard SOL transfer. Derive amounts from the actual curve and simulation, verify quotes, and require finalized receipts and balance assertions. No hosted-wallet compatibility is claimed by this local-keypair test.

[Machine-readable results, quotes, balance snapshots, signatures and cleanup](pump-buy-surfpool-2026-10-08.json). These transaction signatures belong to the local fork and are not mainnet explorer links.
