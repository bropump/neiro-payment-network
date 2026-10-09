# Three checks before releasing a payment signature

Use your preferred operator and existing transaction builder. These examples address the rent, swap and retry mistakes found in the product trials. They supplement the [five-step payment flow](BUILD-WITH-NEIRO.md#start-with-a-payment); they are not another SDK or a complete payment client.

Keep signer secrets out of diagnostics. Load key files directly into the signer; never print them or recursively dump a fixture directory. A wallet file can be a raw JSON array of key bytes, so filtering field names such as `secret` does not redact it. Log only explicitly selected public fields and redact credential-bearing RPC URLs before printing errors.

Run the dependency-free checks from the repository root:

```sh
node --test tools/kora-publisher/client/*.test.mjs
```

The [small reference file](../tools/kora-publisher/client/payment-safety.example.mjs) contains the functions used below. It does not discover operators, sign, decode arbitrary program instructions or calculate every program's costs.

## 1. Charge account rent only when it is actually needed

**A `CreateIdempotent` instruction is not evidence of new rent.** If its ATA already exists, it normally does not allocate another account. The operator's estimate and your calculation can both be wrong if both simply count creation instructions.

For a classic SPL transfer with at most one new recipient ATA:

1. Derive the ATA with your existing Solana library. Fetch that exact address through your trusted RPC. A successful response with `value: null` means absent; an RPC error does not.
2. Validate an existing account's token program, mint, wallet owner and initialized state. It needs **zero new creation rent**. Do not infer invalidity or add a top-up solely because its lamports are below today's reported new-account minimum. Omit its redundant standalone ATA-creation instruction from the unsigned transaction when safe for this builder; simulate the completed operation to check its execution requirements.
3. For an absent classic SPL ATA, fetch `getMinimumBalanceForRentExemption(165)` and use the operator as creation payer. Token-2022 extensions and other account types require their actual size/rent calculation; do not use 165 for them.
4. Include the principal and one NEIRO reimbursement instruction. Call `getFeeForMessage` on that completed message. This network fee already includes priority fees.

```js
// RPC responses obtained independently, not from Kora's quote.
const rent = classicAtaRent({
  account: accountInfo.value, mint, wallet: recipient,
  rentExemptLamports: await rpc('getMinimumBalanceForRentExemption', [165]),
});
const networkFee = await rpc('getFeeForMessage', [messageBase64, {commitment:'confirmed'}]);
const costLamports = completedTransferCost({
  networkFeeLamports: networkFee.value, recipientRentLamports: rent,
});
// Pass costLamports, authenticated terms and independent oracle inputs to verifyQuote.
// Replace the provisional reimbursement, re-quote, verify, and simulate before signing.
```

Pass the user's authorized `maxFeeRaw` explicitly to `verifyQuote`. Its conservative default is 5 NEIRO; it does not read your application or test-fixture authorization. Never raise a cap merely to accommodate an unverified quote.

This calculation is valid only for that restricted transfer shape: no other sponsored accounts, SOL advance, transfer tax or program outflow. For a deposit or swap, separately account for its actual additional costs and refunds. Keep application principal separate from gas. Account reads can change before execution; refresh affected inputs before approval and reject/rebuild if they change. Simulation is not a reservation.

If Kora still quotes rent for an existing account, **reject before signing**. Remove only the proven-redundant setup instruction from the unsigned transaction, then rebuild, re-quote and simulate. Do not increase your cost input or add a tolerance to agree with the operator. If the builder's internal setup cannot safely be changed, stop with a fee-model mismatch rather than claim a verified quote.

The observed Neutral Trade failure charged **6,302,688 raw NEIRO** for an operator outflow that justified **4,161,444** at the fixture price and 5% margin. The difference was existing wSOL ATA rent plus markup. The reference regression rejects that exact overcharge. These are synthetic test amounts, not live prices.

In the [ATA program's idempotent path](https://github.com/solana-program/associated-token-account/blob/main/program/src/processor.rs), an existing token account returns after validating its owner and mint, before the new-account rent calculation. An unsigned fork probe also accepted an existing initialized ATA holding 1,488,440 lamports when that fork reported a 2,039,280 allocation minimum. This does not replace full-operation simulation or authorize changing program-owned balances.

### Seeded account funding: preserve the base signer

For an existing `@solana/web3.js` builder that emits `CreateAccountWithSeed`, rebuild it with the official constructor. **Do not just assign `ix.keys[0] = operator`.** When the payer changes but the base remains the customer, the constructor adds the separate base signer account the instruction needs:

```js
import {SystemInstruction, SystemProgram} from '@solana/web3.js';

// Apply only to an instruction already identified/approved as CreateWithSeed.
const original = SystemInstruction.decodeCreateWithSeed(instruction);
const sponsored = SystemProgram.createAccountWithSeed({
  ...original, fromPubkey: operatorPublicKey,
});
// basePubkey, newAccountPubkey, seed, space, lamports and programId stay unchanged.
```

Then rebuild the unsigned message, check its accounts and costs, quote and simulate. A missing base-account meta is an instruction-construction bug; collecting a customer signature before verification does not repair it.

## 2. Preserve the swap the user approved

Get a current quote for the user's input, output token and slippage limit. Decode the returned program instructions with the product's documented interface and check those terms. Keep an independent snapshot of the approved product instructions before adapting separate setup funders or the transaction fee payer.

```js
const approvedSwap = structuredClone(builderSwapInstructions); // normalized plain data
// Assemble sponsorship around these instructions. Do not change swap data/accounts.
assertProductInstructionsUnchanged(approvedSwap, completedSwapInstructions);
```

This is an equality guard, not a decoder or a substitute for checking the original quote. Preserve the original signer roles and all required setup/cleanup effects too. If the product instruction itself needs a documented adaptation, inspect and approve that separately; do not broadly disable the guard.

**A slippage rejection is a stop, not permission to lower minimum output to 1.** Request a fresh quote within the same authorized limit and rebuild unsigned. If a live quote cannot execute on a stale fork without violating that limit, record an inconclusive fork/quote mismatch. Do not turn it into a compatibility pass. Once customer signatures have been released, reconcile that attempt first.

## 3. A lost response must not create a second payment

Use a stable application operation ID: it identifies the business intent, so the same purchase or transfer keeps the same ID across restarts. **Do not append `retry-1`, an attempt number or a timestamp to bypass an existing claim.** Before requesting any signature, acquire its exclusive claim in persistent private storage. Save the approved message, customer-signed bytes, identities, amounts, fee cap and transaction lifetime durably before releasing those bytes to Kora.

The local example deliberately stops on **any existing operation directory**, even after a crash or success. It does not guess whether it is safe to retry:

```js
await releasePaymentOnce(operationDirectory, async () => {
  // Under the exclusive claim: authenticate, build, verify, simulate, approve, sign.
  return {approvedMessageBase64, customerSignedTransactionBase64,
    operator, blockhash, lastValidBlockHeight, maxFeeRaw: String(maxFeeRaw),
    operation: {recipient, amountRaw: String(amountRaw)}, selectedRecord};
}, async saved => {
  // The private pending.json is already flushed before this call can run.
  return kora('signTransaction', {
    transaction: saved.customerSignedTransactionBase64, signer_key: saved.operator,
  });
});
```

Provision the private parent directory first. This is a conservative single-host filesystem example; it requires directory flushing support and fails closed if unavailable. A multi-host application should use its database's durable unique-operation constraint/transaction. Do not use a new timestamp ID, delete a lock or clear a pending record just because a call timed out. Preserve failed preparation claims for inspection too.

After Kora responds, verify unchanged message bytes and every required signature; save the transaction ID and fully signed bytes before your broadcast. Use the [reconciliation rules](BUILD-WITH-NEIRO.md#5-submit-and-confirm) for unresolved attempts. A local exception before your own broadcast is still uncertain once Kora has received customer-signed bytes: Kora can broadcast them itself. Keep that operation pending until its outcome is established; a local `NOT_SENT` label is insufficient. An expired blockhash alone does not prove no payment landed. Identical-byte rebroadcast and authorizing a new transaction are different decisions.

The tests exercise a lost response and two competing OS processes, asserting that only one can prepare/release a payment. They do not implement automatic recovery. Real payments still need transaction-local receipt checks and the full client flow.
