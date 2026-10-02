# Optional Docker setup

This is one way to run official upstream Kora. NEIRO supplies configuration and helper scripts; the image comes directly from Solana Foundation. For another host or a native installation, follow [Kora](https://github.com/solana-foundation/kora).

These helpers require Node.js 20+, Docker and Buildx. The commands select the upstream AMD64 image; an ARM host needs compatible emulation or a native upstream build. Hardware capacity depends on traffic and your RPC service; this repository does not publish measured minimum CPU/RAM requirements.

From this repository's root:

```sh
umask 077
export NEIRO_OPERATOR_DIR="$HOME/.config/neiro-operator"
mkdir -p "$NEIRO_OPERATOR_DIR"
chmod 700 "$NEIRO_OPERATOR_DIR"
cp examples/operator/*.toml "$NEIRO_OPERATOR_DIR/"
node scripts/resolve-kora-main.mjs > "$NEIRO_OPERATOR_DIR/kora-main.json"
export KORA_IMAGE="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.NEIRO_OPERATOR_DIR+'/kora-main.json','utf8')).image")"
docker pull --platform linux/amd64 "$KORA_IMAGE"
```

Edit `~/.config/neiro-operator/kora.toml` to set your fee and transaction allowance. The template recommends `allowed_programs = "All"` and a 0.25 SOL allowance; the 50% markup is an editable example. Retain the supplied fee-payer policies and read the current sponsor exposure and pending migration in [CONFIGURATION.md](../CONFIGURATION.md).

Use a dedicated payer keypair stored privately as `~/.config/neiro-operator/payer.json`. Fund it with mainnet SOL and prepare its NEIRO token account to receive payments. A positive NEIRO balance is not a router admission requirement. Keep enough SOL for the transactions you intend to sponsor; the Cloudflare router does not enforce a dollar-denominated wallet minimum. Funds remain in your custody.

Load `RPC_URL` and `JUPITER_API_KEY` through your secret manager. Stock Kora uses Jupiter for its pricing; the router does not supply this credential.

## Validate and start

The Cloudflare router expects a publicly callable Kora endpoint. The template has no configured API key. Do not inject `KORA_API_KEY` or HMAC/reCAPTCHA requirements into this public profile; such endpoints cannot be used by this router without a different access design. Do not remove authentication from a live deployment just to join. Review the intended public service, Kora permissions, request limits and funding first.

The memory signer expects key material in `KORA_PRIVATE_KEY`, not a file path. Load it without printing it:

```sh
: "${RPC_URL:?Load your RPC URL}"
: "${JUPITER_API_KEY:?Load your Jupiter key}"
chmod 600 "$NEIRO_OPERATOR_DIR/payer.json"
export KORA_PRIVATE_KEY="$(cat "$NEIRO_OPERATOR_DIR/payer.json")"

docker run --rm --platform linux/amd64 --network none   -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   -v "$NEIRO_OPERATOR_DIR:/config:ro"   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml config validate --signers-config /config/signers.toml

docker run --rm --platform linux/amd64 --name neiro-provider   -p 127.0.0.1:8080:8080   -v "$NEIRO_OPERATOR_DIR:/config:ro"   -e RPC_URL -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml rpc start --signers-config /config/signers.toml
unset KORA_PRIVATE_KEY
```

Environment-backed keys remain accessible to the host/container administrator. Keep access to the host and Docker restricted. Put your HTTPS reverse proxy in front of local port 8080; cloud container hosts can supply their own HTTPS ingress. Use a public hostname intended for public registration, with no credentials in its URL and no redirects. Retain rate limits and monitor RPC quotas. Direct requests still rely on Kora's policy and reimbursement checks.

Keep the foreground terminal open. Use a second terminal for registration and quote checks, setting the variables shown in the registration guide there.

Then follow [router registration](REGISTRATION.md). Your HTTPS host must serve the verification JSON as well as forwarding Kora requests.

## After the first quote: run in the background

After registration and the quote check work, stop the foreground container with Ctrl-C. Reload the same private environment, including `KORA_PRIVATE_KEY`, then repeat the start command with `-d --restart unless-stopped` in place of `--rm`. Unset the key variable after startup. Docker must stay running. Confirm Kora and the HTTPS/proof service return after restart before setting up updates.

## Updates

Arrange a host scheduler to run the following every five minutes, using absolute paths to this repository and a private writable state directory:

```sh
node scripts/update-kora-operator.mjs --container neiro-provider --state-dir "$NEIRO_OPERATOR_DIR/update-state"
```

The updater resolves the official main image afresh, pins its digest, validates the operator's own config offline and replaces the container only when the image changes. It preserves the private environment, mounted config, startup arguments and ports. It checks local `getVersion` after startup, restores the original container if replacement fails and records a stopped rollback container on success. A stopped operator stays stopped. Keep the scheduler output for update failures; `docker restart` alone does not upgrade an image. Native/cloud deployments need the equivalent platform update job. Our Bunny deployment follows the repository's main-image refresh workflow.

For a macOS LaunchAgent, put private copies of `resolve-kora-main.mjs` and `update-kora-operator.mjs` together with its state/logs under `~/Library/Application Support/NEIRO-Kora`, rather than a protected Documents workspace. Use an absolute Node path, an explicit PATH containing Docker, `StartInterval = 300` and `RunAtLoad = true`. Keep directories private and verify an actual scheduled run exits successfully. Pause automatic checks before a deliberate rollback, otherwise the next check will select the latest main image again.

Main is upstream's integration branch and can include unaudited commits. A merged/buildable image is not a security certification. Pinning prevents changes during a running deployment; regular resolution keeps the deployment current. The Kora binary's version string can remain unchanged between main builds, so record the image digest and upstream commit as well.

```sh
docker ps --filter name=neiro-provider
docker restart neiro-provider
docker stop neiro-provider
```

After a successful upgrade, call [router verification](REGISTRATION.md#after-an-upgrade-or-config-change). The Docker updater checks local Kora health but does not call router verification itself.
