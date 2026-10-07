// Adapt Kora's signers.toml to the published official Keychain JS 1.4.0 APIs.
// Secret strings are passed directly to Keychain; no key parsing or signing here.
import {parse} from 'smol-toml';
import type {MessagePartialSigner, SignableMessage} from '@solana/signers';
type Environment = Readonly<Record<string, string | undefined>>;
type Configuration = Record<string, unknown>;
interface Backend {packageName: string; factory: string; fields: Record<string, string>}
export interface MappedSigner {packageName: string; factory: string; config: Record<string, string>}

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

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const object = (value: unknown): value is Configuration => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

async function boundedRemoteCall<T>(operation: () => T | Promise<T>, remote: boolean): Promise<T> {
  if (!remote) return operation();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Keychain 1.4.0 has a 60s per-fetch timeout. Bound the entire operation
    // independently; late results cannot escape this rejected promise.
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Remote signer timeout')), 30_000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Pure adapter. Its returned config contains secrets: never log or serialize it.
export function mapSignerConfig(signer: unknown, env: Environment = process.env): MappedSigner {
  requireCondition(object(signer), 'Signer configuration must be a table');
  requireCondition(nonempty(signer.name), 'Signer name is required');
  requireCondition(typeof signer.type==='string' && Object.hasOwn(backends, signer.type), 'Unsupported signer backend');
  const backend: Backend = backends[signer.type as keyof typeof backends];
  const allowed = new Set(['name', 'type', 'weight', ...Object.keys(backend.fields)]);
  if (signer.type !== 'memory') allowed.add('http_config');
  if (signer.type === 'openfort') allowed.add('api_base_url');
  requireCondition(Object.keys(signer).every(field => allowed.has(field)), 'Unsupported signer configuration field');
  if (Object.hasOwn(signer, 'weight')) {
    requireCondition(typeof signer.weight==='number' && typeof signer.weight==='number' && Number.isSafeInteger(signer.weight) && signer.weight >= 0 && signer.weight <= 0xffffffff,
      'Signer weight must be a u32 integer');
  }
  if (Object.hasOwn(signer, 'http_config')) {
    // Unlike Rust, the published JS factories offer no per-signer HTTP timeouts.
    requireCondition(object(signer.http_config) && Object.keys(signer.http_config).length === 0,
      'Keychain JS 1.4.0 cannot preserve custom http_config; use a supported configuration');
  }
  requireCondition(object(env), 'Signer environment must be an object');
  const config: Record<string, string> = {};
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
    try { url = new URL(typeof signer.api_base_url==='string'?signer.api_base_url:''); } catch { /* Report without printing the URL. */ }
    requireCondition(typeof signer.api_base_url === 'string' && url?.protocol === 'https:' &&
      !url.username && !url.password && !url.search && !url.hash, 'Openfort api_base_url must be a credential-free HTTPS URL');
    config.baseUrl = signer.api_base_url;
  }
  return {packageName: backend.packageName, factory: backend.factory, config};
}

export function selectSignerConfig(signersTomlString: string, signerName?: string): Configuration {
  requireCondition(typeof signersTomlString === 'string', 'signers.toml must be supplied as text');
  let document: unknown;
  try { document = parse(signersTomlString); } catch { throw new Error('Invalid signers.toml'); }
  requireCondition(object(document) && Object.keys(document).every(key => ['signer_pool', 'signers'].includes(key)),
    'Unsupported signers.toml field');
  requireCondition(object(document.signer_pool) &&
    Object.keys(document.signer_pool).every(key => key === 'strategy') &&
    (document.signer_pool.strategy===undefined || (typeof document.signer_pool.strategy==='string' && ['round_robin', 'random', 'weighted'].includes(document.signer_pool.strategy))),
  'Invalid signer pool configuration');
  requireCondition(Array.isArray(document.signers) && document.signers.length > 0, 'At least one signer is required');
  const signers: unknown[] = document.signers;
  const names = new Set<string>();
  for (const signer of signers) {
    requireCondition(object(signer) && nonempty(signer.name), 'Signer name is required');
    requireCondition(!names.has(signer.name), 'Duplicate signer name');
    names.add(signer.name);
    if (document.signer_pool.strategy === 'weighted' && Object.hasOwn(signer, 'weight')) {
      requireCondition(typeof signer.weight==='number' && Number.isSafeInteger(signer.weight) && signer.weight > 0 && signer.weight <= 0xffffffff,
        'Weighted signer must have a positive u32 weight');
    }
  }
  requireCondition(signerName === undefined || nonempty(signerName), 'Invalid signer name selection');
  const selected = signerName === undefined ? signers : signers.filter((signer: unknown) => object(signer) && signer.name === signerName);
  requireCondition(selected.length === 1, 'Select exactly one signer with --signer-name');
  const selectedSigner: unknown = selected[0];requireCondition(object(selectedSigner),'Signer configuration must be a table');return selectedSigner;
}

export async function loadSigner(signersTomlString: string, signerName?: string, env: Environment = process.env): Promise<MessagePartialSigner> {
  const selected = selectSignerConfig(signersTomlString, signerName);
  const {config} = mapSignerConfig(selected, env);
  const remote = selected.type !== 'memory';
  let signer: MessagePartialSigner;
  try {
    // Literal imports keep official factory/config types checked and load only
    // the selected provider. Environment mapping remains the pure adapter above.
    signer = await boundedRemoteCall(async (): Promise<MessagePartialSigner> => {
      switch (selected.type) {
        case 'memory': return (await import('@solana/keychain-memory')).createMemorySigner({privateKeyString: config.privateKeyString});
        case 'turnkey': return (await import('@solana/keychain-turnkey')).createTurnkeySigner({
          apiPublicKey:config.apiPublicKey,apiPrivateKey:config.apiPrivateKey,organizationId:config.organizationId,
          privateKeyId:config.privateKeyId,publicKey:config.publicKey});
        case 'privy': return (await import('@solana/keychain-privy')).createPrivySigner({appId:config.appId,appSecret:config.appSecret,walletId:config.walletId});
        case 'vault': return (await import('@solana/keychain-vault')).createVaultSigner({
          vaultAddr:config.vaultAddr,vaultToken:config.vaultToken,keyName:config.keyName,publicKey:config.publicKey});
        case 'openfort': return (await import('@solana/keychain-openfort')).createOpenfortSigner({
          secretKey:config.secretKey,accountId:config.accountId,walletSecret:config.walletSecret,
          ...(config.baseUrl===undefined?{}:{baseUrl:config.baseUrl})});
        default: throw new Error('Unsupported signer backend');
      }
    }, remote);
    requireCondition(typeof signer.address === 'string' && typeof signer.signMessages === 'function', 'Invalid Keychain signer');
  } catch {
    // Provider/parser errors can include credentials; do not expose their cause.
    throw new Error('Keychain signer initialization failed');
  }
  return Object.freeze({
    address: signer.address,
    async signMessages(messages: readonly SignableMessage[]) {
      try { return await boundedRemoteCall(() => signer.signMessages(messages), remote); }
      catch { throw new Error('Keychain message signing failed'); }
    },
  });
}
