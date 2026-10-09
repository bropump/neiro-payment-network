# Work with NPN

- **Client / builder:** follow [Build with NEIRO](docs/BUILD-WITH-NEIRO.md) and the [tested rent, swap and retry examples](docs/CLIENT-PAYMENT-CHECKS.md). Choose a preferred operator once and reuse it; verify current terms, costs and the completed quote for every payment. Operator installation and repeated fastest/cheapest comparisons are not required.
- **Operator:** follow the five setup steps below. [Host and installation details](docs/OPERATOR-SETUP.md) expand them.

## Operator setup

Keep official Kora, its SDK and our runner unchanged. Do not build another installer, router or SDK to complete setup.

## Before starting

Inspect the chosen host and reuse existing access, signer, RPC, fees and private files. Create missing configs and service definitions yourself. Ask only for unresolved host/access, signer choice, fee, funding budget, public hostname and payment-test limits. Never request keys in chat. Preserve wallet recovery access and existing accounts.

Use a current checkout of this repository in your own task. Check `git status`, fetch `origin/main`, and compare revisions before using an existing checkout; do not reset another task's edits. Record the NPN commit. Choose **production** or **temporary Surfpool test** from the user's request; tests must not change production services or publish test operators on mainnet.

## 1. Install latest upstream Kora and the runner

**Required Kora version: current official upstream `main`, identified by commit SHA.** Never choose a crates.io/stable release, an old executable on `PATH`, or a digest copied from a test report. Those reports identify historical evidence, not today's install target.

For a Docker-compatible host, confirm the selected Docker context and working engine first. Run in `sh`/`bash`:

```sh
set -eu
NPN_KORA_SHA="$(git ls-remote https://github.com/solana-foundation/kora.git refs/heads/main | cut -f1)"
test "${#NPN_KORA_SHA}" -eq 40
docker pull --platform linux/amd64 ghcr.io/solana-foundation/kora:edge
NPN_KORA_REVISION="$(docker image inspect ghcr.io/solana-foundation/kora:edge --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
if [ "$NPN_KORA_REVISION" != "$NPN_KORA_SHA" ]; then
  echo 'Edge does not match current main; wait for its build and retry.' >&2
  exit 1
fi
NPN_KORA_IMAGE="$(docker image inspect ghcr.io/solana-foundation/kora:edge --format '{{index .RepoDigests 0}}')"
printf 'Source: %s\nImage: %s\n' "$NPN_KORA_SHA" "$NPN_KORA_IMAGE"
docker run --rm --platform linux/amd64 "$NPN_KORA_IMAGE" kora --version
```

Deploy that digest, including on remote container platforms such as Bunny. Verify the actual deployed image, not only the local cache. ARM hosts need working amd64 emulation for this image; otherwise use the [exact-revision native build commands](docs/OPERATOR-SETUP.md#install-kora-and-the-listing-runner). Check upstream's current architecture support. Container commands are `IMAGE kora ...`, not `IMAGE --config ...`.

Install Node.js 24+ and Git if absent. From the repository root:

```sh
cd tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
node runner.ts --help
```

Run subsequent `node runner.ts` commands from this directory. `/PRIVATE/...` and `YOUR_OPERATOR_PUBLIC_KEY` are placeholders; replace them with private absolute paths and the selected public key. Save the Kora SHA, digest/native binary hash and actual executable/service path. Recheck main before deployment if setup takes long enough for it to change.

**PASS:** the installed/deployed revision matches resolved main and the runner starts. A missing/failed latest build is a blocker; do not downgrade or change policy to fit an old binary.

## 2. Configure the signer, fees and funding

Use [kora.toml](examples/operator/kora.toml) and [signers.toml](examples/operator/signers.toml) for a new operator; preserve deliberate settings in existing deployments. Configure the user's fee—margin, fixed NEIRO or free—and SOL/priority limits. The example margin is not the user's choice. `max_allowed_lamports` checks modeled outflow and network fees separately; it is not a daily budget or a guarantee against failed-transaction losses.

Use the selected [signer backend](docs/SIGNING.md) in both services. Verify their public keys agree. A remote adapter's existence does not prove its transaction and attestation signing work; test the selected backend. Never export a remote key or substitute a local wallet to bypass a problem. Check the [runner's signer and pool limitations](docs/SIGNING.md#listing-runner-compatibility) before choosing a deployment; `--signer-name` selects the local entry, not the endpoint's pool response.

Load `RPC_URL` for Kora, `SOLANA_RPC_URL` for the runner, `JUPITER_API_KEY` and the signer's credentials from private storage. Reuse working RPC access; [RPC setup options](docs/OPERATOR-SETUP.md#free-rpc-options) apply when none exists. Verify mainnet genesis, finalized account/block reads and discovery scans. Live Kora checks follow protected startup in step 3; verify its paid quote in step 5. Redact credential-bearing URLs and keys from subprocess errors **before** returning logs.

Fund the operator with the authorized SOL amount. Run these using the selected Kora binary/image, private environment and mounted config paths:

```sh
kora --config /PRIVATE/kora.toml config validate --signers-config /PRIVATE/signers.toml
kora --config /PRIVATE/kora.toml rpc initialize-atas --signers-config /PRIVATE/signers.toml --fee-payer-key YOUR_OPERATOR_PUBLIC_KEY
```

Inspect multi-signer ATA scope before submitting. Reuse existing ATAs. The operator needs SOL and a NEIRO receiving account, not an initial NEIRO deposit. Prepare a separate customer's NEIRO for the authorized payment test.

**PASS:** config/signers validate; the chosen wallet, SOL balance and NEIRO receipt account are independently confirmed on the intended chain.

## 3. Protect the listing, then start Kora

```sh
node runner.ts protect --operator YOUR_OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml
```

This derives the operator's listing address, adds it to `[validation].disallowed_accounts` and backs up the file. It does not restart Kora. Apply the protected file to **every instance sharing that signer**, including every region, before serving requests. Deny the listing account, not the operator wallet or the entire Record program.

Start/restart the selected build with the protected config:

```sh
kora --config /PRIVATE/kora.toml rpc start --signers-config /PRIVATE/signers.toml --port 8080
```

Use the host's service manager. Set up HTTPS for production; keep internal/metrics ports private. Verify live `getConfig` and `getPayerSigner`: signer, payment address, NEIRO mint, fee model, limits and listing deny entry must match. The runner currently requires HTTPS and supplies no API-key/HMAC/CAPTCHA credentials; resolve endpoint compatibility without silently removing existing access controls.

**Test enforcement:** use an unsigned, non-asset-moving `signTransaction` probe that reaches account validation and includes the derived listing as a read-only account. Require the actual RPC rejection to name the disallowed account. Never add a customer signature to an asset-moving probe: the operator could co-sign and broadcast it despite a sign-only request. If unsigned validation cannot reach the check, mark it untested or use a separately authorized isolated fixture. A timeout, disabled method, authentication failure, missing account or unrelated simulation error is inconclusive. Match the expected rejection outside any catch that labels a test PASS. Also test rejection above the priority cap and a within-cap control without releasing unauthorized payment signatures. Probe each deployed instance, not just one load-balanced response. [Safe test boundaries](docs/BUILD-WITH-NEIRO.md#test-your-client-before-use).

**PASS:** the actual running instances use the intended settings and reject the protected-account probe. A file edit or successful quote is insufficient.

## 4. Publish, renew and track upstream updates

With the same signer environment and RPC, start:

```sh
node runner.ts renew --watch \
  --operator YOUR_OPERATOR_PUBLIC_KEY --url https://YOUR_OPERATOR_HOST/ \
  --config /PRIVATE/kora.toml --signers-config /PRIVATE/signers.toml \
  --state-dir /PRIVATE/renewal
```

It publishes on first run and checks hourly; unchanged terms renew after 24 chain hours and readers reject them at 48 hours. Save the finalized publication receipt. `unchanged` means an existing valid listing is current; an error is not registration.

Install this exact command as **one supervised worker per signer**, with persistent private state. Stop the foreground worker before starting its service. No extra daily job or worker per region. Configure Kora and the worker to restart after failure/reboot; verify restart and state retention. Never delete `pending.json` or switch state directories to bypass an uncertain send; use [recovery instructions](docs/RENEWAL.md#when-a-check-fails).

Run independently:

```sh
node runner.ts discover
```

Require your derived record with a valid signature, current chain anchor, correct signer/payment/URL/mint and fees matching live Kora. Discovery alone does not prove the endpoint is responding or quotes are correct.

Install the host's **five-minute Kora main update check** using step 1's revision comparison. Validate config before rollout, preserve signer/config/state, verify the deployed revision and repeat protection and authorized payment checks after rollout. Retain rollback; report a rollback/failed update as out of date. The listing runner does not update Kora, and this repository does not supply a universal host updater. Record and test the actual updater's schedule and commands; a pinned image alone is insufficient. Monitor service failure, low SOL and renewal age approaching 48 hours; verify alert delivery.

**PASS:** verified discovery, restart/state retention, one renewal worker, functioning main-update checks and monitoring. The first actual daily renewal remains a dated follow-up until observed; do not claim it already happened.

## 5. Prove a payment and report the result

Follow the [direct payment sequence](docs/BUILD-WITH-NEIRO.md#start-with-a-payment) with the authorized customer, recipient, amount and fee cap. Discover this operator, authenticate terms, compare live config, independently verify the completed quote including reimbursement, inspect the message and sign. Verify unchanged returned message bytes and signatures. Durably journal the approved message, customer-signed bytes and lifetime before releasing any customer signature to Kora; add the expected transaction signature when available. Check pending state before overwriting it on restart, and reconcile uncertain outcomes before creating another payment.

**PASS:** a finalized successful transaction, the intended recipient amount, user SOL behavior and exact operator SOL/NEIRO deltas match the approved transaction. A quote, simulation or free payment does not prove paid pricing. For an explicitly free deployment, verify zero reimbursement and label it free-only; do not change its fee to force a paid test.

Recover only authorized temporary funds and eligible test accounts; keep operational listings, receipt ATAs and wallet recovery access. Return a short table with steps 1–5 marked **PASS / FAIL / NOT RUN**, supporting SHA/config results/receipts, public signer/listing/URL and exact host start/stop/status/log commands. Missing funding, signer access, service evidence or payment authorization means the affected check remains incomplete—not a reason to invent a pass.

## If this is a Surfpool test

Use isolated services, fresh test keys and synthetic funds. Mock pricing is test-only. The runner CLI requires HTTPS even on a local fork; use controlled test HTTPS or the existing `surfpool.mjs` publisher integration test, which does **not** itself prove Kora payment setup. Never point a mainnet Kora service at test transactions. Record account seeding separately from real account creation. On remote-account-fetch errors, diagnose the datasource/missing accounts before retrying; do not keep submitting identical failures. Finish with local finalized receipts and cleanup, and mark production HTTPS, live pricing and unattended operation untested where applicable.

For command-not-found errors, resolve the actual executable and shell environment. Never use zsh's special `path` variable for a wallet filename; use `wallet_file`. Never print private environment files or unredacted logs.

Commit repository changes only as `bropump`.
