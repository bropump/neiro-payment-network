# Run a NEIRO operator

Run official Kora, choose your fee and register with the Rust router's on-chain registry. You do not need to host a router. The [tutorial](../TUTORIAL.md) explains the pricing options.

## Prepare your host

Operators run the latest successfully published official upstream **main build**, not the latest tagged release. Resolve it at every installation and update, then pin its immutable digest for the running process. The checked-in image file records a snapshot; it does not hold new installs on an older build. Upstream publishes `edge` after a successful main build. While a newer commit is building or its build fails, use the latest successfully published main image.

The example uses Docker with Buildx and Node.js 20+. The official main image currently supports AMD64. On Apple Silicon, Docker runs it with emulation; a native ARM installation must build unchanged official source at the resolved `upstream_commit` and use the same config/signer files. Do not patch Kora or the TypeScript SDK.

From this repository's root:

```sh
mkdir -p work/my-provider
cp examples/operator/*.toml work/my-provider/
node scripts/resolve-kora-main.mjs > work/my-provider/kora-main.json
export KORA_IMAGE="$(node -p "JSON.parse(require('node:fs').readFileSync('work/my-provider/kora-main.json','utf8')).image")"
docker pull --platform linux/amd64 "$KORA_IMAGE"
```

Edit `work/my-provider/kora.toml` to set your fee and transaction allowance. The template recommends `allowed_programs = "All"` and a 0.25 SOL allowance; the 50% markup is an editable example. Retain the supplied fee-payer policies and read the current sponsor exposure and pending migration in [CONFIGURATION.md](../CONFIGURATION.md).

Use a dedicated payer keypair stored privately as `work/my-provider/payer.json`. Fund it with SOL and put NEIRO in its canonical token account. The router requires at least $1 of SOL and $1 of NEIRO at its latest check, plus enough SOL to execute the intended transactions. Funds remain in your custody.

Load `RPC_URL` and `JUPITER_API_KEY` through your secret manager. Stock Kora uses Jupiter for its pricing; the router's separate NEIRO price feed does not replace this credential.

## Validate and start

The Rust public router expects a publicly callable Kora endpoint. The template has no configured API key. Do not inject `KORA_API_KEY` or HMAC/reCAPTCHA requirements into this public profile; such endpoints cannot be used by this router without a different access design. Do not remove authentication from a live deployment just to join. Review the intended public service, Kora permissions, request limits and funding first.

The memory signer expects key material in `KORA_PRIVATE_KEY`, not a file path. Load it without printing it:

```sh
: "${RPC_URL:?Load your RPC URL}"
: "${JUPITER_API_KEY:?Load your Jupiter key}"
chmod 600 work/my-provider/payer.json
export KORA_PRIVATE_KEY="$(cat work/my-provider/payer.json)"

docker run --rm --platform linux/amd64 --network none   -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   -v "$PWD/work/my-provider:/config:ro"   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml config validate --signers-config /config/signers.toml

docker run -d --platform linux/amd64 --name neiro-provider --restart unless-stopped   -p 127.0.0.1:8080:8080   -v "$PWD/work/my-provider:/config:ro"   -e RPC_URL -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml rpc start --signers-config /config/signers.toml
unset KORA_PRIVATE_KEY
```

Environment-backed keys remain accessible to the host/container administrator. Keep access to the host and Docker restricted. Put your HTTPS reverse proxy in front of local port 8080; cloud container hosts can supply their own HTTPS ingress. Use a public hostname intended for registry publication, with no credentials in its URL and no redirects. Retain rate limits and monitor RPC quotas. Direct requests still rely on Kora's policy and reimbursement checks.

## Register and verify

Follow [on-chain registration](REGISTRATION.md). This replaces the older HTTP `register-node.mjs` workflow. The operator signs locally; a router never receives its private key. Registration and renewal spend transaction fees and expose the registered endpoint and payer on Solana.

After publication, verify discovery and admission, then request a payer-pinned quote. Full payment tests must confirm the final on-chain result and reimbursement. A process starting or a quote succeeding is not a completed payment.

## Keep it running

Arrange a host scheduler to run the following every five minutes, using absolute paths to this repository and a private writable state directory:

```sh
node scripts/update-kora-operator.mjs --container neiro-provider --state-dir work/my-provider/update-state
```

The updater resolves the official main image afresh, pins its digest, validates the operator's own config offline and replaces the container only when the image changes. It preserves the private environment, mounted config, startup arguments and ports. It checks local `getVersion` after startup, restores the original container if replacement fails and records a stopped rollback container on success. A stopped operator stays stopped. Keep the scheduler output for update failures; `docker restart` alone does not upgrade an image. Native/cloud deployments need the equivalent platform update job. Our Bunny deployment follows the repository's main-image refresh workflow.

For a macOS LaunchAgent, put private copies of `resolve-kora-main.mjs` and `update-kora-operator.mjs` together with its state/logs under `~/Library/Application Support/NEIRO-Kora`, rather than a protected Documents workspace. Use an absolute Node path, an explicit PATH containing Docker, `StartInterval = 300` and `RunAtLoad = true`. Keep directories private and verify an actual scheduled run exits successfully. Pause automatic checks before a deliberate rollback, otherwise the next check will select the latest main image again.

Main is upstream's integration branch and can include unaudited commits. A merged/buildable image is not a security certification. Pinning prevents changes during a running deployment; regular resolution keeps the deployment current. The Kora binary's version string can remain unchanged between main builds, so record the image digest and upstream commit as well.

```sh
docker ps --filter name=neiro-provider
docker restart neiro-provider
docker stop neiro-provider
```

After editing fees, validate and restart, then obtain a new quote. Monitor SOL liquidity, NEIRO holdings, RPC/Jupiter quotas, Kora health and registration expiry. Renew before expiry as described in REGISTRATION.md. Stop the service and publish a higher-revision revocation when leaving the network; stopping a process alone does not revoke its public record.
