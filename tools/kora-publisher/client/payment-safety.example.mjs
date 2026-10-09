// Small reference boundaries, not a transaction builder or payment SDK.
import assert from 'node:assert/strict';
import {mkdirSync, openSync, writeFileSync, fsyncSync, closeSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {keybytes} from './read-record.mjs';

const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const U64 = (1n << 64n) - 1n;
function uint(value) {
  assert.ok(typeof value === 'bigint' ||
    (typeof value === 'number' && Number.isSafeInteger(value)), 'safe integer required');
  const n = BigInt(value);
  assert.ok(n >= 0n && n <= U64, 'u64 required');
  return n;
}

// account must be the fresh getAccountInfo value for the ATA derived with your
// Solana library, not the operator's description or a caught RPC error.
// This example supports classic SPL accounts only, not Token-2022 extensions.
export function classicAtaRent({account, mint, wallet, rentExemptLamports}) {
  keybytes(mint); keybytes(wallet);
  if (account === null) return uint(rentExemptLamports);
  assert.ok(account && account.executable === false, 'account unavailable or executable');
  assert.equal(account.owner, TOKEN, 'wrong account program');
  assert.equal(account.data?.[1], 'base64', 'base64 account data required');
  const data = Buffer.from(account.data[0], 'base64');
  assert.equal(data.length, 165, 'classic SPL account required');
  assert.deepEqual(data.subarray(0, 32), keybytes(mint), 'wrong mint');
  assert.deepEqual(data.subarray(32, 64), keybytes(wallet), 'wrong token owner');
  assert.equal(data[108], 1, 'token account must be initialized and unfrozen');
  uint(account.lamports);
  // Today's allocation minimum is not a validity test for an existing account.
  // Idempotent ATA creation returns after owner/mint validation; simulate the
  // complete operation separately rather than inventing a rent top-up here.
  return 0n;
}

export function completedTransferCost({networkFeeLamports, recipientRentLamports}) {
  // getFeeForMessage already includes priority fees. This restricted example has
  // no other account creation, payer outflow, transfer tax or SOL advance.
  return uint(uint(networkFeeLamports) + uint(recipientRentLamports));
}

// Snapshot the approved product instructions before sponsorship adaptations.
// For ordinary swaps change only separate setup funding / transaction fee payer;
// preserve the swap instructions (including accounts, data and output bounds).
export function assertProductInstructionsUnchanged(approved, completed) {
  assert.deepEqual(completed, approved, 'product instructions changed; rebuild and reapprove');
}

function syncDirectory(directory) {
  const fd = openSync(directory, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function savePrivate(file, value) {
  const fd = openSync(file, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); }
  finally { closeSync(fd); }
  syncDirectory(dirname(file));
}

// Local single-host example: provision a persistent private parent directory.
// The stable operation directory is an exclusive, permanent claim. An existing
// directory ALWAYS stops this example, including after timeout, crash or success.
// No stale-lock deletion, automatic recovery or replacement payment is provided.
// A multi-host app needs its database's durable unique-operation transaction.
export async function releasePaymentOnce(operationDirectory, prepare, release) {
  mkdirSync(operationDirectory, {mode: 0o700}); // EEXIST before any signing
  syncDirectory(dirname(operationDirectory));
  const attempt = await prepare(); // inspect/simulate/approve/sign only under claim
  assert.equal(typeof attempt.approvedMessageBase64, 'string');
  assert.ok(attempt.approvedMessageBase64.length > 0);
  assert.equal(typeof attempt.customerSignedTransactionBase64, 'string');
  assert.ok(attempt.customerSignedTransactionBase64.length > 0);
  assert.equal(typeof attempt.operator, 'string'); keybytes(attempt.operator);
  assert.equal(typeof attempt.blockhash, 'string'); keybytes(attempt.blockhash);
  uint(attempt.lastValidBlockHeight);
  assert.equal(typeof attempt.maxFeeRaw, 'string');
  assert.match(attempt.maxFeeRaw, /^(0|[1-9][0-9]*)$/);
  assert.ok(BigInt(attempt.maxFeeRaw) <= U64);
  // Include your exact operation/amounts and selected listing in attempt too.
  // Callbacks still enforce all message, signature, quote and authorization checks.
  savePrivate(join(operationDirectory, 'pending.json'), attempt);
  return await release(attempt); // first time customer signature may leave client
}
