import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {getBase58Decoder} from '@solana/codecs-strings';
import {loadSigner, mapSignerConfig, selectSignerConfig} from './signer.ts';

const memoryToml = `[signer_pool]
strategy = "round_robin"
[[signers]]
name = "operator"
type = "memory"
private_key_env = "OPERATOR_KEY"
weight = 1
`;
const base = {name: 'operator', type: 'memory', private_key_env: 'OPERATOR_KEY'};

test('memory mapping passes the configured secret unchanged to official Keychain', () => {
  const secret = ' [1,2,3] ';
  assert.deepEqual(mapSignerConfig(base, {OPERATOR_KEY: secret}), {
    packageName: '@solana/keychain-memory', factory: 'createMemorySigner', config: {privateKeyString: secret},
  });
});

const remoteCases = [
  ['turnkey', 'createTurnkeySigner', {
    api_public_key_env: ['API_PUBLIC', 'apiPublicKey'], api_private_key_env: ['API_PRIVATE', 'apiPrivateKey'],
    organization_id_env: ['ORGANIZATION', 'organizationId'], private_key_id_env: ['KEY_ID', 'privateKeyId'],
    public_key_env: ['PUBLIC_KEY', 'publicKey'],
  }],
  ['privy', 'createPrivySigner', {
    app_id_env: ['APP_ID', 'appId'], app_secret_env: ['APP_SECRET', 'appSecret'], wallet_id_env: ['WALLET_ID', 'walletId'],
  }],
  ['vault', 'createVaultSigner', {
    vault_addr_env: ['VAULT_ADDR', 'vaultAddr'], vault_token_env: ['VAULT_TOKEN', 'vaultToken'],
    key_name_env: ['VAULT_KEY', 'keyName'], pubkey_env: ['PUBLIC_KEY', 'publicKey'],
  }],
  ['openfort', 'createOpenfortSigner', {
    secret_key_env: ['SECRET_KEY', 'secretKey'], account_id_env: ['ACCOUNT_ID', 'accountId'], wallet_secret_env: ['WALLET_SECRET', 'walletSecret'],
  }],
];
for (const [type, factory, fields] of remoteCases) {
  test(`${type} preserves existing Kora environment references and published JS field names`, () => {
    const selected = {name: 'operator', type}, env = {}, config = {};
    for (const [field, [reference, target]] of Object.entries(fields)) {
      selected[field] = reference; env[reference] = `mock-${reference}`; config[target] = env[reference];
    }
    assert.deepEqual(mapSignerConfig(selected, env), {packageName: `@solana/keychain-${type}`, factory, config});
    assert.deepEqual(mapSignerConfig({...selected, http_config: {}}, env).config, config);
    for (const http_config of [{request_timeout_secs: 15}, {connect_timeout_secs: 5}, null, 'ignored']) {
      assert.throws(() => mapSignerConfig({...selected, http_config}, env), /cannot preserve custom http_config/);
    }
    if (type === 'openfort') {
      assert.equal(mapSignerConfig({...selected, api_base_url: 'https://openfort.example/'}, env).config.baseUrl,
        'https://openfort.example/');
      for (const url of ['http://openfort.example/', 'https://user:secret@openfort.example/', 'https://openfort.example/?secret=x', 'invalid']) {
        assert.throws(() => mapSignerConfig({...selected, api_base_url: url}, env), /credential-free HTTPS/);
      }
    } else {
      assert.throws(() => mapSignerConfig({...selected, api_base_url: 'https://override.example/'}, env), /Unsupported/);
    }
    if (type === 'vault') {
      const {vault_addr_env, vault_token_env, ...other} = selected;
      assert.throws(() => mapSignerConfig({...other, addr_env: vault_addr_env, token_env: vault_token_env}, env), /Unsupported signer configuration field/);
    }
  });
}

const privyToml = `[signer_pool]
[[signers]]
name = "remote"
type = "privy"
app_id_env = "APP"
app_secret_env = "SECRET"
wallet_id_env = "WALLET"
`;
const privyEnv = {APP: 'mock-app', SECRET: 'mock-secret', WALLET: 'mock-wallet'};
const walletResponse = () => ({ok: true, json: async () => ({address: '11111111111111111111111111111111', chain_type: 'solana'})});

test('remote factory rejects at 30 seconds, clears its timer, and discards late completion', async t => {
  await import('@solana/keychain-privy');
  t.mock.timers.enable({apis: ['setTimeout']});
  const clear = t.mock.method(globalThis, 'clearTimeout');
  let completeFetch, started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, 'fetch', () => { started(); return new Promise(resolve => { completeFetch = resolve; }); });
  const pending = loadSigner(privyToml, undefined, privyEnv);
  const rejection = assert.rejects(pending, error => error.message === 'Keychain signer initialization failed' && error.cause === undefined);
  await startedPromise;
  let settled = false; pending.then(() => { settled = true; }, () => { settled = true; });
  t.mock.timers.tick(29_999); await Promise.resolve(); assert.equal(settled, false);
  t.mock.timers.tick(1); await rejection;
  assert.equal(clear.mock.callCount(), 1);
  completeFetch(walletResponse());
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(pending, /initialization failed/);
});

test('remote signing rejects at 30 seconds and never returns a late provider result', async t => {
  t.mock.method(globalThis, 'fetch', async () => walletResponse());
  const signer = await loadSigner(privyToml, undefined, privyEnv);
  t.mock.timers.enable({apis: ['setTimeout']});
  const clear = t.mock.method(globalThis, 'clearTimeout');
  let completeFetch, started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  globalThis.fetch.mock.mockImplementation(() => { started(); return new Promise(resolve => { completeFetch = resolve; }); });
  const pending = signer.signMessages([{content: new Uint8Array([0, 1]), signatures: {}}]);
  const rejection = assert.rejects(pending, error => error.message === 'Keychain message signing failed' && error.cause === undefined);
  await startedPromise;
  t.mock.timers.tick(30_000); await rejection;
  assert.equal(clear.mock.callCount(), 1);
  completeFetch({ok: true, json: async () => ({data: {signature: Buffer.alloc(64).toString('base64'), encoding: 'base64'}})});
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(pending, /message signing failed/);
});

test('remote provider errors are suppressed and successful initialization clears the deadline', async t => {
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const fetch = t.mock.method(globalThis, 'fetch', async () => walletResponse());
  await loadSigner(privyToml, undefined, privyEnv);
  assert.equal(clear.mock.callCount(), 1);
  fetch.mock.mockImplementation(async () => { throw new Error('DO_NOT_LOG_PROVIDER_SECRET'); });
  await assert.rejects(loadSigner(privyToml, undefined, privyEnv), error =>
    error.message === 'Keychain signer initialization failed' && !error.stack.includes('DO_NOT_LOG_PROVIDER_SECRET'));
  assert.equal(clear.mock.callCount(), 2);
});

test('configuration errors never include secret values or parse fragments', async () => {
  const secret = 'DO_NOT_LOG_SECRET';
  for (const env of [{}, {OPERATOR_KEY: ''}, {OPERATOR_KEY: '  '}, {OPERATOR_KEY: 42}, Object.create({OPERATOR_KEY: secret})]) {
    assert.throws(() => mapSignerConfig(base, env), /Missing or empty environment value/);
  }
  assert.throws(() => mapSignerConfig({...base, private_key_env: 'BAD=REFERENCE'}, {OPERATOR_KEY: secret}), /Invalid environment reference/);
  assert.throws(() => mapSignerConfig({...base, private_key: secret}, {OPERATOR_KEY: secret}), /Unsupported signer configuration field/);
  await assert.rejects(loadSigner(`${memoryToml}\nsecret = "${secret}`, undefined, {}), error =>
    error.message === 'Invalid signers.toml' && !String(error.stack).includes(secret) && error.cause === undefined);
  await assert.rejects(loadSigner(memoryToml, undefined, {OPERATOR_KEY: secret}), error =>
    error.message === 'Keychain signer initialization failed' && !String(error.stack).includes(secret) && error.cause === undefined);
});

test('selection is explicit with multiple signers and rejects duplicate or missing names', () => {
  const two = `${memoryToml}\n[[signers]]\nname = "second"\ntype = "memory"\nprivate_key_env = "SECOND_KEY"\n`;
  assert.equal(selectSignerConfig(memoryToml).name, 'operator');
  assert.throws(() => selectSignerConfig(two), /Select exactly one/);
  assert.equal(selectSignerConfig(two, 'second').private_key_env, 'SECOND_KEY');
  assert.throws(() => selectSignerConfig(two, 'missing'), /Select exactly one/);
  assert.throws(() => selectSignerConfig(two, ''), /Invalid signer name/);
  assert.throws(() => selectSignerConfig(two.replace('name = "second"', 'name = "operator"'), 'operator'), /Duplicate/);
  assert.throws(() => selectSignerConfig(memoryToml.replace('name = "operator"', 'name = ""')), /name is required/);
  assert.throws(() => selectSignerConfig('[signer_pool]\nstrategy="random"'), /At least one/);
});

test('unsupported backend, malformed pool and invalid weights fail before Keychain loading', async () => {
  for (const type of ['aws_kms', 'para', 'constructor', '', undefined]) {
    assert.throws(() => mapSignerConfig({...base, type}, {}), /Unsupported signer backend/);
  }
  assert.throws(() => selectSignerConfig(memoryToml.replace('round_robin', 'first')), /Invalid signer pool/);
  assert.throws(() => selectSignerConfig(memoryToml.replace('round_robin', 'weighted').replace('weight = 1', 'weight = 0')), /positive u32/);
  for (const weight of [-1, 1.5, 0x100000000, '1']) {
    assert.throws(() => mapSignerConfig({...base, weight}, {OPERATOR_KEY: 'unused'}), /weight must be a u32/);
  }
  await assert.rejects(loadSigner(memoryToml.replace('type = "memory"', 'type = "unsupported"'), undefined, {}), /Unsupported/);
});

for (const encoding of ['json', 'base58']) {
  test(`official memory signer signs exact raw bytes from a Kora ${encoding} key environment value`, async t => {
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network access in memory test'); });
    // Ephemeral offline test key. Production code neither generates nor decodes keys.
    const keys = generateKeyPairSync('ed25519');
    const pub = keys.publicKey.export({format: 'der', type: 'spki'}).subarray(-32);
    const seed = keys.privateKey.export({format: 'der', type: 'pkcs8'}).subarray(-32);
    const keypair = Buffer.concat([seed, pub]);
    const secret = encoding === 'json' ? JSON.stringify([...keypair]) : getBase58Decoder().decode(keypair);
    const pool = `${memoryToml}\n[[signers]]\nname = "unselected"\ntype = "privy"\napp_id_env = "NO_APP"\napp_secret_env = "NO_SECRET"\nwallet_id_env = "NO_WALLET"\n`;
    const signer = await loadSigner(pool, 'operator', {OPERATOR_KEY: secret});
    assert.equal(signer.address, getBase58Decoder().decode(pub));
    const content = new Uint8Array([0, 255, 1, 2, 0, 128]);
    const [dictionary] = await signer.signMessages([{content, signatures: {}}]);
    const signature = dictionary[signer.address];
    assert.equal(signature.length, 64);
    assert.equal(verify(null, content, keys.publicKey, signature), true);
    assert.equal(verify(null, new Uint8Array([1, ...content]), keys.publicKey, signature), false);
    assert.deepEqual(content, new Uint8Array([0, 255, 1, 2, 0, 128]));
    await assert.rejects(signer.signMessages([{content: null, signatures: {}}]), error =>
      error.message === 'Keychain message signing failed' && error.cause === undefined);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}
