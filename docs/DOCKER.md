# Optional Docker setup

This is one way to run official upstream Kora. NEIRO supplies configuration and helper scripts; the image comes directly from Solana Foundation. For another host or a native installation, follow [Kora](https://github.com/solana-foundation/kora).

The helper scripts live on this repository's `operator-maintenance` branch. Run the commands below from a checkout of that branch; the public templates are also maintained on `main`.

These helpers require Node.js 20+, Docker and Buildx. The commands select the upstream AMD64 image; an ARM host needs compatible emulation or a native upstream build. Hardware capacity depends on traffic and your RPC service; this repository does not publish measured minimum CPU/RAM requirements.

From this repository's root:

```sh
umask 077
export NEIRO_OPERATOR_DIR="$HOME/.config/neiro-operator"
mkdir -p "$NEIRO_OPERATOR_DIR"
chmod 700 "$NEIRO_OPERATOR_DIR"
cp -n examples/operator/*.toml "$NEIRO_OPERATOR_DIR/" # Keep existing operator configs
node scripts/resolve-kora-main.mjs > "$NEIRO_OPERATOR_DIR/kora-main.json"
export KORA_IMAGE="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.NEIRO_OPERATOR_DIR+'/kora-main.json','utf8')).image")"
docker pull --platform linux/amd64 "$KORA_IMAGE"
```

Edit `~/.config/neiro-operator/kora.toml` to set your fee and transaction allowance. The template recommends `allowed_programs = "All"` and a 0.25 SOL allowance; the 50% markup is an editable example. Retain the supplied fee-payer policies and read the current sponsor exposure and pending migration in [CONFIGURATION.md](../CONFIGURATION.md).

Reuse the operator's existing signer and payer identity. Fund that payer with SOL and prepare its NEIRO token account to receive payments. A positive NEIRO balance is not a router admission requirement. Keep enough SOL for the transactions you intend to sponsor. Funds remain in your custody.

Use the existing private Docker environment file supplied by your secret manager. It must provide the RPC/pricing credentials and the environment references required by the existing signer configuration. Set its path without printing its contents:

```sh
export NEIRO_OPERATOR_ENV="$NEIRO_OPERATOR_DIR/operator.env"
```

Docker consumes this file directly; the update helper never reads it or retrieves a running container's environment. Keep its permissions private. Do not replace the payer or copy its signing key into update scripts.

## Validate and start

The Cloudflare router expects a publicly callable Kora endpoint. The template has no configured API key. Do not inject `KORA_API_KEY` or HMAC/reCAPTCHA requirements into this public profile; such endpoints cannot be used by this router without a different access design. Do not remove authentication from a live deployment just to join. Review the intended public service, Kora permissions, request limits and funding first.

Validate and start with the same private environment reference:

```sh
docker run --rm --platform linux/amd64 --network none \
  --env-file "$NEIRO_OPERATOR_ENV" -v "$NEIRO_OPERATOR_DIR:/config:ro" \
  --entrypoint kora "$KORA_IMAGE" \
  --config /config/kora.toml config validate --signers-config /config/signers.toml

docker run --rm --platform linux/amd64 --name neiro-provider \
  -p 127.0.0.1:8080:8080 --env-file "$NEIRO_OPERATOR_ENV" \
  -v "$NEIRO_OPERATOR_DIR:/config:ro" --entrypoint kora "$KORA_IMAGE" \
  --config /config/kora.toml rpc start --port 8080 --signers-config /config/signers.toml
```

Environment-backed keys remain accessible to the host/container administrator. Keep access to the host and Docker restricted. Put your HTTPS reverse proxy in front of local port 8080; cloud container hosts can supply their own HTTPS ingress. Use a public hostname intended for public registration, with no credentials in its URL and no redirects. Retain rate limits and monitor RPC quotas. Direct requests still rely on Kora's policy and reimbursement checks.

Keep the foreground terminal open. Use a second terminal for registration and quote checks, setting the variables shown in the registration guide there.

Then follow [router registration](REGISTRATION.md). Your HTTPS host must serve the verification JSON as well as forwarding Kora requests.

For a working reverse proxy and proof-file example, follow [HTTPS.md](HTTPS.md).

## After the first quote: run in the background

After registration and the quote check work, stop the foreground container with Ctrl-C. Reload the same private environment and run:

```sh
docker run -d --platform linux/amd64 --name neiro-provider --restart unless-stopped \
  -p 127.0.0.1:8080:8080 --env-file "$NEIRO_OPERATOR_ENV" \
  -v "$NEIRO_OPERATOR_DIR:/config:ro" --entrypoint kora "$KORA_IMAGE" \
  --config /config/kora.toml rpc start --port 8080 --signers-config /config/signers.toml
```

Docker must stay running. Confirm Kora and the HTTPS/proof service return after restart before setting up updates. Loopback port 8080 is intentionally reached through your front proxy; publishing that port alone does not provide HTTPS or the proof file.

## Updates

Arrange a host scheduler to run the following every five minutes, using absolute paths to the helper checkout, the existing environment/config files and a private writable state directory:

```sh
node scripts/update-kora-operator.mjs --container neiro-provider \
  --env-file "$NEIRO_OPERATOR_ENV" --config-dir "$NEIRO_OPERATOR_DIR" \
  --state-dir "$NEIRO_OPERATOR_DIR/update-state" --public-profile
```

The examples use `--public-profile` only for an operator that is already publicly accessible. Before changing anything, the helper requires unauthenticated `getConfig` and `getPayerSigner` to succeed. The explicit flag passes empty Docker overrides for `KORA_API_KEY`, `KORA_HMAC_SECRET` and `KORA_RECAPTCHA_SECRET`, preventing stale values in an old environment file from unexpectedly making that existing public service private. It never reads or edits the environment file. Omit the flag to preserve those environment values; never use it to convert a private operator to public access.

The supported Docker profile has one bind mount at `/config`, one loopback mapping to container port 8080, bridge networking, no privileged mode and no custom CPU/memory limits. The helper uses Kora's standard `/config/kora.toml` and `/config/signers.toml` startup command. Deployments with other startup arguments, authentication or additional Docker settings need their own host adapter; this helper does not promise to preserve arbitrary Docker configuration.

The updater resolves the official main image, checks its revision and validates the operator's config offline before replacement. Docker loads the existing environment file without exposing its contents to the helper. The helper preserves the config mount, port, restart policy, payer identity and all publicly reported Kora settings. It permits the new upstream default `allowed_transaction_versions = ["legacy", 0, 1]` only when that field was absent from the old public response; every other unexpected settings difference fails verification. It verifies `getConfig` and `getPayerSigner`, restores the original container/config on failure, and retains a stopped rollback container on success. A stopped operator stays stopped. Use the same state directory for manual and scheduled runs so their lock prevents overlap. Keep scheduler output private. `docker restart` alone does not upgrade an image.

### Enable launch metadata on an existing operator

The image must include upstream main commit `d5a7e64b9e5603cfea5d4c5196553a60f19f9f7e`, which merges metadata reconstruction fix `cbef6ec`. The resolver rejects earlier images. The canonical preset enables:

```toml
[validation.token_2022]
allow_token_metadata_instructions = true

[validation.fee_payer_policy.system]
allow_transfer = true
```

The System transfer setting permits payer-funded launch/rent transfers and is broader than rent alone. NEIRO reimbursement and the configured transaction allowance still apply. Keep existing fee choices and other payer restrictions. The migration flag below changes only the metadata opt-in; it does not alter System-transfer policy or operator fees.

Use the already verified release pin for a deliberate metadata rollout:

```sh
node scripts/update-kora-operator.mjs --container neiro-provider \
  --env-file "$NEIRO_OPERATOR_ENV" --config-dir "$NEIRO_OPERATOR_DIR" \
  --state-dir "$NEIRO_OPERATOR_DIR/update-state" \
  --candidate-lock examples/operator/kora-release.json --enable-metadata --public-profile
```

Bunny uses the GitHub `Latest official Kora main` workflow. Its five-minute refresh and manual runs share one concurrency group, check out `operator-maintenance`, and commit validated pins back to that branch. Dispatch with `enable_metadata: true` to use the already tested pin, skip resolving a newer image, and apply the narrow metadata startup migration. The default is false; normal image updates retain the existing startup configuration. The Bunny helper reads only platform `/overview` and `/endpoints`, preserves environment values server-side, discards PATCH response bodies, and checks the public payer/settings before accepting a rollout. Its one-time metadata migration requires the recorded existing startup lineage; use a different adapter for unrelated Bunny deployments.

For a macOS LaunchAgent, put private copies of `resolve-kora-main.mjs` and `update-kora-operator.mjs` together with its state/logs under `~/Library/Application Support/NEIRO-Kora`, rather than a protected Documents workspace. Use an absolute Node path, an explicit PATH containing Docker, `StartInterval = 300` and `RunAtLoad = true`. Keep directories private and verify an actual scheduled run exits successfully. Pause automatic checks before a deliberate rollback, otherwise the next check will select the latest main image again.

Main is upstream's integration branch and can include unaudited commits. A merged/buildable image is not a security certification. Pinning prevents changes during a running deployment; regular resolution keeps the deployment current. The Kora binary's version string can remain unchanged between main builds, so record the image digest and upstream commit as well.

```sh
docker ps --filter name=neiro-provider
docker logs --tail 50 neiro-provider # Recent startup/errors; avoid sharing secrets from logs
docker restart neiro-provider # Restart the existing container/config
docker stop neiro-provider # Stop serving
docker start neiro-provider # Start that stopped container
```

After a successful upgrade, call [router verification](REGISTRATION.md#after-an-upgrade-or-config-change). The Docker updater checks local Kora health but does not call router verification itself.
