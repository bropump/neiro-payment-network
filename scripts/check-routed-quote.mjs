// Read-only setup check. No keys, signatures, transfers or submission.
// Node.js 20+. The sample has no instructions: it checks quoting, not app acceptance.
const [router, operator] = process.argv.slice(2);
if (!router || !/^[a-f0-9]{32}$/.test(operator || '')) {
  console.error('Usage: node scripts/check-routed-quote.mjs ROUTER_BASE_URL OPERATOR_ID');
  process.exit(1);
}
const base = new URL(router);
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
  throw Error('Use a public HTTPS router base URL without credentials, query or fragment');
}
const url = new URL('/rpc', base);
url.searchParams.set('operator', operator);
async function call(method, params = {}) {
  const response = await fetch(url, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error || !body.result || body.id !== 1) throw Error(`${method}: no successful RPC result`);
  return body.result;
}
function keyBytes(value) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) throw Error('Invalid public key/blockhash');
  let n = 0n;
  for (const c of value) {
    const digit = alphabet.indexOf(c);
    if (digit < 0) throw Error('Invalid base58 character');
    n = n * 58n + BigInt(digit);
  }
  const bytes = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) { bytes[i] = Number(n & 255n); n >>= 8n; }
  if (n) throw Error('Public key/blockhash exceeds 32 bytes');
  return bytes;
}
try {
  const identity = await call('getPayerSigner');
  const hash = await call('getBlockhash');
  // Legacy wire format: one zero-filled signature; one signer/payer; no instructions.
  const wire = Buffer.alloc(134);
  wire[0] = 1; wire[65] = 1; wire[68] = 1;
  keyBytes(identity.signer_address).copy(wire, 69);
  keyBytes(hash.blockhash).copy(wire, 101);
  const quote = await call('estimateTransactionFee', {
    transaction: wire.toString('base64'),
    fee_token: 'CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump',
    signer_key: identity.signer_address,
  });
  if (quote.signer_pubkey !== identity.signer_address || quote.payment_address !== identity.payment_address ||
      quote.fee_in_token == null || quote.fee_in_lamports == null) throw Error('Quote identity or fee missing/mismatched');
  console.log(JSON.stringify({ok: true, operator, payer: identity.signer_address,
    feeLamports: quote.fee_in_lamports, feeNeiroSmallestUnits: quote.fee_in_token,
    scope: 'Unsigned empty-transaction quote only; nothing signed or submitted.'}, null, 2));
} catch (error) {
  console.error('Quote check failed: ' + error.message);
  process.exitCode = 1;
}
