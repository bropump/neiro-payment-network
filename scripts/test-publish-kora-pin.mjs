import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishPin} from './publish-kora-pin.mjs';

const template = fileURLToPath(new URL('../examples/operator/', import.meta.url));
const manifest = 'examples/operator/kora-release.json';
function git(cwd, args, env = {}) {
  return execFileSync('git', args, {cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, ...env}});
}
function commit(dir, message) {
  git(dir, ['add', '.']);
  git(dir, ['-c', 'user.name=bropump', '-c', 'user.email=203769166+bropump@users.noreply.github.com',
    'commit', '--quiet', '-m', message]);
}
const cases = ['publish', 'no-op', 'concurrent-docs', 'changed-config',
  'concurrent-config', 'denied-push', 'checkout-auth'];
for (const scenario of cases) {
  const dir = mkdtempSync(join(tmpdir(), 'neiro-pin-test-'));
  try {
    const remote = join(dir, 'origin.git');
    const source = join(dir, 'source');
    const editor = join(dir, 'editor');
    mkdirSync(source);
    git(dir, ['init', '--bare', '--quiet', '--initial-branch=main', remote]);
    git(source, ['init', '--quiet', '--initial-branch=main']);
    git(source, ['remote', 'add', 'origin', remote]);
    cpSync(template, join(source, 'examples/operator'), {recursive: true});
    const target = JSON.parse(readFileSync(join(source, manifest)));
    const old = {...target, upstream_commit: '1'.repeat(40), image_tag: '1111111',
      image: 'ghcr.io/solana-foundation/kora@sha256:' + '1'.repeat(64)};
    if (scenario !== 'no-op') writeFileSync(join(source, manifest), JSON.stringify(old));
    commit(source, 'Public fixture');
    git(source, ['push', 'origin', 'main']);
    git(dir, ['clone', '--quiet', remote, editor]);
    writeFileSync(join(source, manifest), JSON.stringify(target));
    if (scenario === 'checkout-auth') git(source, ['config', 'http.https://github.com/.extraheader', 'AUTHORIZATION: public-fixture-only']);
    const change = () => {
      if (scenario.includes('config')) {
        writeFileSync(join(editor, 'examples/operator/kora.toml'), '# Concurrent config\n');
      } else {
        writeFileSync(join(editor, 'new-doc.txt'), 'Keep this concurrent edit\n');
        const pin = JSON.parse(readFileSync(join(editor, manifest)));
        pin.operator_settings = 'Concurrent public documentation';
        writeFileSync(join(editor, manifest), JSON.stringify(pin));
      }
      commit(editor, 'Concurrent edit');
      git(editor, ['push', 'origin', 'main']);
    };
    if (scenario === 'changed-config') change();
    let pushes = 0, authObserved = false;
    const runGit = (cwd, args, env) => {
      if (env?.GIT_CONFIG_VALUE_0 === 'AUTHORIZATION: public-fixture-only') authObserved = true;
      assert(!args.some(arg => arg.includes('AUTHORIZATION:')), 'Credentials must not appear in process arguments');
      if (args[0] === 'push') {
        pushes++;
        if (scenario === 'denied-push') throw new Error('Fixture permission failure');
        if (pushes === 1 && scenario.startsWith('concurrent-')) change();
      }
      return git(cwd, args, env);
    };
    if (scenario.includes('config')) {
      assert.throws(() => publishPin(source, {runGit}), /Public config changed/);
    } else if (scenario === 'denied-push') {
      assert.throws(() => publishPin(source, {runGit}), /push rejected/);
      assert.equal(pushes, 1);
    } else {
      const result = publishPin(source, {runGit});
      assert.equal(result.status, scenario === 'no-op' ? 'current' : 'published');
      assert.equal(pushes, scenario === 'no-op' ? 0 : scenario === 'concurrent-docs' ? 2 : 1);
      const published = JSON.parse(git(remote, ['show', 'main:' + manifest]));
      assert.equal(published.image, target.image);
      if (scenario === 'concurrent-docs') {
        assert.equal(published.operator_settings, 'Concurrent public documentation');
        assert.equal(git(remote, ['show', 'main:new-doc.txt']), 'Keep this concurrent edit\n');
      }
      if (scenario === 'checkout-auth') assert(authObserved);
    }
    if (scenario.includes('config') || scenario === 'denied-push') {
      assert.equal(JSON.parse(git(remote, ['show', 'main:' + manifest])).image, old.image);
    }
    console.log('PASS: ' + scenario);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}
