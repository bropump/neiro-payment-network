// Resolve the latest successfully published official main build, then pin it.
// No Kora source changes. Requires Node 20+ and Docker Buildx.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const repository = 'ghcr.io/solana-foundation/kora';
const upstream = 'https://github.com/solana-foundation/kora';
function inspect(reference, field) {
  try {
    return JSON.parse(execFileSync('docker', ['buildx', 'imagetools', 'inspect',
      '--format', `{{json .${field}}}`, reference], {encoding:'utf8', timeout:120000}));
  } catch { throw new Error('Could not inspect the official Kora image'); }
}
async function github(path) {
  const headers = {'Accept':'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/solana-foundation/kora/${path}`,
    {headers, redirect:'error', signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Upstream verification failed (GitHub HTTP ${response.status})`);
  return response.json();
}
export async function resolveMain() {
  const manifest = inspect(`${repository}:edge`, 'Manifest');
  if (!/^sha256:[a-f0-9]{64}$/.test(manifest.digest)) throw new Error('Invalid official image digest');
  const image = `${repository}@${manifest.digest}`;
  // Inspect the immutable reference, so a moving edge tag cannot mix revisions.
  const metadata = inspect(image, 'Image');
  const labels = metadata.config?.Labels ?? {};
  const revision = labels['org.opencontainers.image.revision'];
  if (labels['org.opencontainers.image.source'] !== upstream || !/^[a-f0-9]{40}$/.test(revision ?? ''))
    throw new Error('Official image source/revision labels are missing');
  const head = await github('commits/main');
  const comparison = await github(`compare/${revision}...${head.sha}`);
  if (!['identical','ahead'].includes(comparison.status))
    throw new Error('Published image is not a merged upstream main commit');
  const platforms = (manifest.manifests ?? []).map(m => m.platform)
    .filter(p => p?.os === 'linux' && p.architecture !== 'unknown')
    .map(p => `${p.os}/${p.architecture}`);
  if (!platforms.length) platforms.push(`${metadata.os}/${metadata.architecture}`);
  return {channel:'main', tag:'edge', upstream, upstream_commit:revision,
    upstream_main_head:head.sha, image_tag:revision.slice(0,7), image,
    published_image_platforms:platforms};
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--image','--update-lock'].includes(args[0])))
    throw new Error('Usage: resolve-kora-main.mjs [--image | --update-lock]');
  const pin = await resolveMain();
  if (args[0] === '--image') { console.log(pin.image); return; }
  if (args[0] === '--update-lock') {
    const path = resolve(fileURLToPath(new URL('../', import.meta.url)), 'examples/operator/kora-release.json');
    const lock = JSON.parse(readFileSync(path, 'utf8'));
    let version;
    try {
      version = execFileSync('docker', ['run','--rm','--platform','linux/amd64','--network','none',
        '--entrypoint','kora',pin.image,'--version'], {encoding:'utf8',timeout:180000}).trim()
        .replace(/^kora(?:-cli)? /,'');
    } catch { throw new Error('Official main image could not start'); }
    if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?$/.test(version)) throw new Error('Invalid binary version');
    const changed = lock.image !== pin.image || lock.channel !== 'main';
    if (changed) writeFileSync(path, JSON.stringify({...lock,...pin,schema_version:2,version,
      verification_scope:'Official main image startup and canonical config/signers validation. Historical payment results retain their original image/config scope.',
      update_policy:'Track the latest successfully published upstream main image. Resolve edge at every installation/update, verify its merged revision, and pin that digest for the running process. Check for updates every five minutes; validate before replacement and retain rollback on failure.'}, null, 2)+'\n');
    console.log(changed ? `Updated official main pin: ${pin.upstream_commit}` : 'Official main pin is current');
    return;
  }
  console.log(JSON.stringify(pin,null,2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode=1; });
