// Adapt Kora's signers.toml to the published official Keychain JS 1.4.0 APIs.
// Secret strings are passed directly to Keychain; no key parsing or signing here.
import {parse} from 'smol-toml';

const backends = Object.freeze({
  memory: {
    packageName: '@solana/keychain-memory', factory: 'createMemorySigner',
    fields: {private_key_env: 'privateKeyString'},
  },
  turnkey: {
    packageName: '@solana/keychain-turnkey', factory: 'createTurnkeySigner',
    fields: {
      api_public_key_env: 'apiPublicKey', api_private_key_env: 'apiPrivateKey',
      organization_id_env: 'organizationId', private_key_id_env: 'privateKeyId', public_key_env: 'publicKey',
    },
  },
  privy: {
    packageName: '@solana/keychain-privy', factory: 'createPrivySigner',
    fields: {app_id_env: 'appId', app_secret_env: 'appSecret', wallet_id_env: 'walletId'},
  },
  vault: {
    packageName: '@solana/keychain-vault', factory: 'createVaultSigner',
    // Kora e77089's Rust struct uses these names; its example's addr_env/token_env do not deserialize.
    fields: {vault_addr_env: 'vaultAddr', vault_token_env: 'vaultToken', key_name_env: 'keyName', pubkey_env: 'publicKey'},
  },
  openfort: {
    packageName: '@solana/keychain-openfort', factory: 'createOpenfortSigner',
    fields: {secret_key_env: 'secretKey', account_id_env: 'accountId', wallet_secret_env: 'walletSecret'},
  },
});

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

async function boundedRemoteCall(operation, remote) {
  if (!remote) return operation();
  let timer;
  try {
    // Keychain 1.4.0 has a 60s per-fetch timeout. Bound the entire operation
    // independently; late results cannot escape this rejected promise.
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Remote signer timeout')), 30_000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Pure adapter. Its returned config contains secrets: never log or serialize it.
export function mapSignerConfig(signer, env = process.env) {
  requireCondition(object(signer), 'Signer configuration must be a table');
  requireCondition(nonempty(signer.name), 'Signer name is required');
  requireCondition(Object.hasOwn(backends, signer.type), 'Unsupported signer backend');
  const backend = backends[signer.type];
  const allowed = new Set(['name', 'type', 'weight', ...Object.keys(backend.fields)]);
  if (signer.type !== 'memory') allowed.add('http_config');
  if (signer.type === 'openfort') allowed.add('api_base_url');
  requireCondition(Object.keys(signer).every(field => allowed.has(field)), 'Unsupported signer configuration field');
  if (Object.hasOwn(signer, 'weight')) {
    requireCondition(Number.isSafeInteger(signer.weight) && signer.weight >= 0 && signer.weight <= 0xffffffff,
      'Signer weight must be a u32 integer');
  }
  if (Object.hasOwn(signer, 'http_config')) {
    // Unlike Rust, the published JS factories offer no per-signer HTTP timeouts.
    requireCondition(object(signer.http_config) && Object.keys(signer.http_config).length === 0,
      'Keychain JS 1.4.0 cannot preserve custom http_config; use a supported configuration');
  }
  requireCondition(object(env), 'Signer environment must be an object');
  const config = {};
  for (const [field, target] of Object.entries(backend.fields)) {
    const reference = signer[field];
    requireCondition(typeof reference === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(reference),
      `Invalid environment reference for ${field}`);
    requireCondition(Object.hasOwn(env, reference) && nonempty(env[reference]),
      `Missing or empty environment value for ${field}`);
    config[target] = env[reference];
  }
  if (Object.hasOwn(signer, 'api_base_url')) {
    let url;
    try { url = new URL(signer.api_base_url); } catch { /* Report without printing the URL. */ }
    requireCondition(typeof signer.api_base_url === 'string' && url?.protocol === 'https:' &&
      !url.username && !url.password && !url.search && !url.hash, 'Openfort api_base_url must be a credential-free HTTPS URL');
    config.baseUrl = signer.api_base_url;
  }
  return {packageName: backend.packageName, factory: backend.factory, config};
}

export function selectSignerConfig(signersTomlString, signerName) {
  requireCondition(typeof signersTomlString === 'string', 'signers.toml must be supplied as text');
  let document;
  try { document = parse(signersTomlString); } catch { throw new Error('Invalid signers.toml'); }
  requireCondition(object(document) && Object.keys(document).every(key => ['signer_pool', 'signers'].includes(key)),
    'Unsupported signers.toml field');
  requireCondition(object(document.signer_pool) &&
    Object.keys(document.signer_pool).every(key => key === 'strategy') &&
    ['round_robin', 'random', 'weighted'].includes(document.signer_pool.strategy ?? 'round_robin'),
  'Invalid signer pool configuration');
  requireCondition(Array.isArray(document.signers) && document.signers.length > 0, 'At least one signer is required');
  const names = new Set();
  for (const signer of document.signers) {
    requireCondition(object(signer) && nonempty(signer.name), 'Signer name is required');
    requireCondition(!names.has(signer.name), 'Duplicate signer name');
    names.add(signer.name);
    if (document.signer_pool.strategy === 'weighted' && Object.hasOwn(signer, 'weight')) {
      requireCondition(Number.isSafeInteger(signer.weight) && signer.weight > 0 && signer.weight <= 0xffffffff,
        'Weighted signer must have a positive u32 weight');
    }
  }
  requireCondition(signerName === undefined || nonempty(signerName), 'Invalid signer name selection');
  const selected = signerName === undefined ? document.signers : document.signers.filter(signer => signer.name === signerName);
  requireCondition(selected.length === 1, 'Select exactly one signer with --signer-name');
  return selected[0];
}

export async function loadSigner(signersTomlString, signerName, env = process.env) {
  const selected = selectSignerConfig(signersTomlString, signerName);
  const {packageName, factory, config} = mapSignerConfig(selected, env);
  const remote = selected.type !== 'memory';
  let signer;
  try {
    // The allowlisted package is imported only after selecting this backend.
    const module = await import(packageName);
    signer = await boundedRemoteCall(() => module[factory](config), remote);
    requireCondition(typeof signer.address === 'string' && typeof signer.signMessages === 'function', 'Invalid Keychain signer');
  } catch {
    // Provider/parser errors can include credentials; do not expose their cause.
    throw new Error('Keychain signer initialization failed');
  }
  return Object.freeze({
    address: signer.address,
    async signMessages(messages) {
      try { return await boundedRemoteCall(() => signer.signMessages(messages), remote); }
      catch { throw new Error('Keychain message signing failed'); }
    },
  });
}
