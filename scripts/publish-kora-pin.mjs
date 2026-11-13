// Publish only the validated image fields, after the Bunny rollout succeeds.
// Use an isolated checkout and ordinary fast-forward pushes: never overwrite
// concurrent public documentation or configuration changes.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const manifest = 'examples/operator/kora-release.json';
const imageFields = ['schema_version', 'upstream', 'tag', 'version',
  'upstream_commit', 'image', 'published_image_platforms', 'verification_scope',
  'channel', 'upstream_main_head', 'image_tag', 'metadata_minimum_commit',
  'runtime_image_digest'];
const git = (cwd, args, env = {}) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
  env: {...process.env, ...env},
});

export function publishPin(root, {runGit = git} = {}) {
  const pin = JSON.parse(readFileSync(join(root, manifest), 'utf8'));
  const remote = runGit(root, ['remote', 'get-url', 'origin']).trim();
  const dir = mkdtempSync(join(tmpdir(), 'neiro-public-pin-'));
  try {
    runGit(dir, ['init', '--quiet']);
    runGit(dir, ['remote', 'add', 'origin', remote]);
    runGit(dir, ['config', 'user.name', 'bropump']);
    runGit(dir, ['config', 'user.email', '203769166+bropump@users.noreply.github.com']);
    // actions/checkout keeps its short-lived authentication in local Git config.
    // Forward it only to this same remote, without logging or storing it in files.
    let auth = '';
    try {
      auth = runGit(root, ['config', '--local', '--get-regexp', '^http\\..*\\.extraheader$']).trim();
    } catch (error) {
      if (error.status !== 1) throw error;
    }
    const authEnv = {};
    const headers = auth ? auth.split('\n') : [];
    if (headers.length) authEnv.GIT_CONFIG_COUNT = String(headers.length);
    headers.forEach((line, index) => {
      const i = line.indexOf(' ');
      authEnv['GIT_CONFIG_KEY_' + index] = line.slice(0, i);
      authEnv['GIT_CONFIG_VALUE_' + index] = line.slice(i + 1);
    });
    const network = args => runGit(dir, args, authEnv);
    for (let attempt = 0; attempt < 3; attempt++) {
      network(['fetch', '--quiet', '--depth=1', 'origin', 'main']);
      runGit(dir, ['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
      const base = runGit(dir, ['rev-parse', 'HEAD']).trim();
      const current = JSON.parse(readFileSync(join(dir, manifest), 'utf8'));
      for (const name of ['kora.toml', 'signers.toml']) {
        const digest = createHash('sha256').update(readFileSync(join(dir, 'examples/operator', name))).digest('hex');
        if (digest !== pin.config_sha256?.[name] || digest !== current.config_sha256?.[name])
          throw new Error('Public config changed since validation; rerun validation before publishing');
      }
      const next = {...current};
      for (const field of imageFields) {
        if (pin[field] === undefined) throw new Error('Validated pin is missing ' + field);
        next[field] = pin[field];
      }
      if (JSON.stringify(next) === JSON.stringify(current)) return {status: 'current', commit: base};
      writeFileSync(join(dir, manifest), JSON.stringify(next, null, 2) + '\n');
      runGit(dir, ['add', '--', manifest]);
      runGit(dir, ['commit', '--quiet', '-m', 'Publish verified Kora image pin']);
      const commit = runGit(dir, ['rev-parse', 'HEAD']).trim();
      try {
        network(['push', 'origin', 'HEAD:refs/heads/main']);
        return {status: 'published', commit};
      } catch {
        network(['fetch', '--quiet', '--depth=1', 'origin', 'main']);
        if (runGit(dir, ['rev-parse', 'FETCH_HEAD']).trim() === base)
          throw new Error('Public pin push rejected; check repository write permission and branch rules');
        // A concurrent commit won the race. Re-read its config and preserve it.
      }
    }
    throw new Error('Public branch kept changing; retry the update workflow');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(publishPin(fileURLToPath(new URL('../', import.meta.url)))));
  } catch (error) {
    // Git errors may contain authentication headers. Never print raw subprocess errors.
    console.error(error instanceof Error && error.message.startsWith('Command failed:')
      ? 'Public pin publication failed; inspect repository access and rerun' : error.message);
    process.exitCode = 1;
  }
}
