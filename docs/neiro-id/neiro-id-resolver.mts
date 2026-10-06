// Selected mainnet namespace. The mac test record was released; resolve current state.
// Read-only example client. No SDK, private key, registrar, or custom RPC method.
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const RECORD_PROGRAM = 'recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5';
export const NAMESPACE_BASE = 'nameAg2pEQgmuxNBGQ333ZWx15EKnFHek64GaSmDSbL';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function requireValue(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
function encode(bytes: Buffer): string {
  let n = BigInt('0x' + bytes.toString('hex')), text = '';
  while (n) { text = alphabet[Number(n % 58n)] + text; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; text = '1' + text; }
  return text;
}
function decode(text: string): Buffer {
  let n = 0n;
  for (const c of text) { const digit = alphabet.indexOf(c); requireValue(digit >= 0, 'Invalid base58'); n = n * 58n + BigInt(digit); }
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex;
  return Buffer.concat([Buffer.alloc(text.match(/^1*/)?.[0].length || 0), n ? Buffer.from(hex, 'hex') : Buffer.alloc(0)]);
}
export function normalizeName(name: string): string {
  requireValue(typeof name === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(name), 'Invalid handle');
  return name.toLowerCase();
}
export function recordAddress(name: string): string {
  return encode(createHash('sha256').update(Buffer.concat([
    decode(NAMESPACE_BASE), Buffer.from('n1:' + normalizeName(name), 'utf8'), decode(RECORD_PROGRAM),
  ])).digest());
}
// Null means absent. A present but invalid account throws: never treat it as
// available, and never return a recipient from invalid data.
export function decodeRecord(name: string, account: unknown) {
  const canonical = normalizeName(name);
  if (account === null) return null;
  requireValue(typeof account === 'object' && account !== null, 'Invalid account response');
  const a = account as Record<string, any>;
  requireValue(a.owner === RECORD_PROGRAM, 'Wrong account owner');
  requireValue(a.executable === false, 'Account must not be executable');
  requireValue(Array.isArray(a.data) && a.data.length === 2 && a.data[1] === 'base64' && typeof a.data[0] === 'string', 'Invalid data encoding');
  // Buffer decoding is permissive; require canonical base64 as returned by RPC.
  requireValue(a.data[0].length === 136, 'Wrong encoded record length');
  const bytes = Buffer.from(a.data[0], 'base64');
  requireValue(bytes.toString('base64') === a.data[0], 'Invalid base64');
  requireValue(bytes.length === 101, 'Wrong record length');
  requireValue(bytes[0] === 1, 'Record not initialized or unsupported version');
  requireValue(bytes.subarray(33, 41).equals(Buffer.from('NEIROID1')), 'Wrong payload magic');
  const expected = Buffer.alloc(24); expected.write(canonical, 'ascii');
  requireValue(bytes.subarray(41, 65).equals(expected), 'Wrong canonical name or padding');
  return { name: canonical, recordAddress: recordAddress(canonical), authority: encode(bytes.subarray(1, 33)), destination: encode(bytes.subarray(65, 97)), revision: bytes.readUInt32LE(97) };
}
export async function resolveName(name: string, endpoint: string, transport: typeof fetch = fetch) {
  const key = recordAddress(name);
  const response = await transport(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [key, { encoding: 'base64', commitment: 'confirmed' }] }),
    signal: AbortSignal.timeout(10000),
  });
  requireValue(response.ok, 'RPC HTTP failure');
  const body = await response.json() as any;
  requireValue(body?.jsonrpc === '2.0' && body.id === 1 && !body.error && body.result && Object.hasOwn(body.result, 'value'), 'Invalid RPC response');
  return decodeRecord(name, body.result.value);
}
