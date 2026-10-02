// Maintainer/CI check, not an installer. No RPC calls, payment or registration.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const configDir = resolve(root, 'examples/operator');
const lock = JSON.parse(readFileSync(resolve(configDir, 'kora-release.json'), 'utf8'));
if (!/^ghcr\.io\/solana-foundation\/kora@sha256:[a-f0-9]{64}$/.test(lock.image) ||
    !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?$/.test(lock.version)) throw Error('Invalid upstream lock');
if(lock.channel!=='main' || !/^[a-f0-9]{40}$/.test(lock.upstream_commit)) throw Error('Official main pin required');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--binary')) throw Error('Usage: verify-stock-kora.mjs [--binary /path/to/stock/kora]');
const native = args.length ? resolve(args[1]) : undefined;
const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const seed = privateKey.export({format:'der', type:'pkcs8'}).subarray(-32);
const pub = publicKey.export({format:'der', type:'spki'}).subarray(-32);
const env = {...process.env, RPC_URL:'http://127.0.0.1:8899',
  JUPITER_API_KEY:'CONFIG_VALIDATION_ONLY',
  KORA_PRIVATE_KEY:JSON.stringify([...seed, ...pub]), NO_COLOR:'1'};
// Prevent host credentials from silently changing this public-profile check.
delete env.KORA_API_KEY;
delete env.KORA_HMAC_SECRET;
delete env.KORA_RECAPTCHA_SECRET;
function invoke(commandArgs) {
  if (native) return execFileSync(native, commandArgs, {env, encoding:'utf8', timeout:30000});
  if (configDir.includes(',')) throw Error('Docker bind mount path contains a comma');
  return execFileSync('docker', ['run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--read-only',
    '--tmpfs', '/tmp', '-e', 'RPC_URL', '-e', 'JUPITER_API_KEY',
    '-e', 'KORA_PRIVATE_KEY', '--mount', `type=bind,src=${configDir},dst=/config,readonly`,
    '--entrypoint', 'kora', lock.image, ...commandArgs], {env, encoding:'utf8', timeout:180000});
}
const metadata=JSON.parse(execFileSync('docker',['buildx','imagetools','inspect','--format','{{json .Image}}',lock.image],
  {encoding:'utf8',timeout:120000}));
if(metadata.config?.Labels?.['org.opencontainers.image.revision']!==lock.upstream_commit ||
   metadata.config?.Labels?.['org.opencontainers.image.source']!=='https://github.com/solana-foundation/kora')
  throw Error('Pinned official image revision/source does not match the main pin');
console.log('Official upstream main commit: '+lock.upstream_commit);
const actual = invoke(['--version']).trim();
if (!["kora " + lock.version, "kora-cli " + lock.version].includes(actual)) throw Error('Unexpected stock Kora version: ' + actual);
console.log(actual);
const koraPath = native ? resolve(configDir, 'kora.toml') : '/config/kora.toml';
const signersPath = native ? resolve(configDir, 'signers.toml') : '/config/signers.toml';
process.stdout.write(invoke(['--config', koraPath, 'config', 'validate', '--signers-config', signersPath]));
console.log('PASS: stock Kora config and signer validation using an ephemeral test key');
