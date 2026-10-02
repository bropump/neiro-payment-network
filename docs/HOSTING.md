# Run wherever Kora runs

NEIRO does not restrict operators to particular hosting providers. Use any environment that can run official Kora and meet the network access requirements below. Upstream documents [local/source installation, container platforms and Railway](https://solana.com/docs/tools/kora/operators#deployment). Mac, Docker and Bunny below are examples, not an exhaustive support list.

Your agent should choose one path with you and follow it, rather than present every path as required work. Any host must be able to run the selected upstream Kora build, reach Solana RPC/Jupiter and expose HTTPS plus the proof file. Verify architecture, toolchain, storage and networking before promising compatibility. The tests in [PLATFORM-TESTS.md](../PLATFORM-TESTS.md) have specific scopes; these instructions are not evidence that every host has been tested.

| Your choice | Start here | Keep it running later |
| --- | --- | --- |
| Mac or Linux, native Kora | Native steps below | Host service manager; keep a Mac awake and online |
| Docker on a compatible host | [Complete Docker commands](DOCKER.md) | Docker restart policy and update helper |
| Bunny Magic Containers | Bunny steps below | Platform deployment, logs and restart controls |
| Another server/container host | Map the same settings below to that host's documented controls | Host service manager or platform deployment controls |

## Native Mac or Linux

Install the compiler/toolchain prerequisites in [upstream Kora](https://github.com/solana-foundation/kora) and Git. On a Mac this includes Apple's command-line developer tools. Rustup must be available so the checkout's `rust-toolchain.toml` selects its required compiler. Do not assume a system Rust version can build current main.

For a new installation, choose a private directory and build unchanged main into a revision-specific location:

```sh
umask 077
export NEIRO_OPERATOR_DIR="$HOME/.config/neiro-operator"
mkdir -p "$NEIRO_OPERATOR_DIR"
chmod 700 "$NEIRO_OPERATOR_DIR"
git clone https://github.com/solana-foundation/kora.git "$NEIRO_OPERATOR_DIR/source"
git -C "$NEIRO_OPERATOR_DIR/source" checkout main
export KORA_REVISION="$(git -C "$NEIRO_OPERATOR_DIR/source" rev-parse HEAD)"
(cd "$NEIRO_OPERATOR_DIR/source" && cargo install --locked --path crates/cli --bin kora --root "$NEIRO_OPERATOR_DIR/builds/$KORA_REVISION")
export KORA_BIN="$NEIRO_OPERATOR_DIR/builds/$KORA_REVISION/bin/kora"
"$KORA_BIN" --version
```

Record that exact revision and use that binary path in the [config/start commands](JOIN.md#2-put-two-config-files-in-one-private-folder), replacing `kora` with `"$KORA_BIN"`. If a build fails, stop before startup and diagnose its actual dependency/toolchain error; do not patch Kora or silently install an older release. Initial builds need substantially more time and disk than running a binary. These commands are derived from upstream's current crate layout; we have not repeated a clean native build for this documentation change.

For later updates, fetch upstream main in this source checkout, select the new revision, and build into a new revision-specific folder. Validate the existing private config with the new binary before changing the service's executable path. Keep the previous binary path for rollback. If startup, payer identity or the routed check fails, restore that previous path and restart. Never overwrite the live binary while building. The agent should automate this sequence after the first working quote and record exact service commands for the chosen OS.

## Bunny Magic Containers

Use Bunny's [deployment guide](https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app) and [container settings](https://docs.bunny.net/docs/magic-containers-how-to-edit-app-configuration). The agent should inspect current platform controls rather than guess UI labels or unsupported mount/network features.

1. Resolve the official upstream Kora image with `scripts/resolve-kora-main.mjs` on a machine with Node.js and Docker/Buildx. Save its `image`, digest and upstream commit. Use the official image in Bunny; no custom Kora build is required.
2. Create one app/container initially. Give it the private `kora.toml` and `signers.toml` as files at `/config/` using the platform's supported file/volume provisioning. If that host cannot provision those files, resolve that before deployment; environment variables do not replace the TOML files.
3. Set entrypoint `kora` and arguments `--config /config/kora.toml rpc start --signers-config /config/signers.toml`. Supply `RPC_URL`, `JUPITER_API_KEY` and your selected signer's credentials through private runtime environment settings. For the memory signer, `KORA_PRIVATE_KEY` is the JSON keypair content, not its local file path.
4. Route an HTTPS endpoint to Kora port 8080. Check deployment logs for successful startup and test `getPayerSigner`/`getConfig`. Record the expected public payer. Keep the same signer and private config across replacements.
5. Give the registered hostname both the Kora route and the verification-file route. A raw Bunny Kora endpoint alone cannot serve the static proof. Use a front proxy/ingress you control; the [HTTPS example](HTTPS.md) shows routing to a remote Kora backend. Register that front URL, then verify and run the quote check.
6. Record the app/container IDs and the platform's exact log, restart, stop and redeploy actions in the operator's runbook. For an upgrade, change to the newly resolved upstream image while preserving files, environment and endpoint. Check health, payer and router verification. On failure restore the previous image digest/settings and redeploy.

`scripts/update-bunny-kora.mjs` updates an **existing** compatible Bunny app; it is not an installer. It reads this repository's `examples/operator/kora-release.json`, so refresh and validate that snapshot with the resolver before using it. It needs private `BUNNY_KORA_API_KEY`, `BUNNY_KORA_APP_ID` and optionally `BUNNY_KORA_CONTAINER_NAME` (default `stock-kora`). It preserves the environment/entrypoint and checks rollout health, but does not provision config files, serve the proof, or call router verification. Review its assumptions against the actual app before scheduling it.

## Other hosts

Map these six requirements to the host: executable/image, two private config files, signer/RPC/Jupiter secret references, long-running process on Kora's port, HTTPS plus proof-file routing, and persistent restart/update controls. Use current host documentation and report unsupported requirements instead of claiming deployment works everywhere. Test startup, payer identity, verification and a routed quote before adding automation.
