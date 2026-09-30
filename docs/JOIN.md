# Run a NEIRO operator

Run official Kora, choose your fee and register with the Rust router's on-chain registry. You do not need to host a router. The [tutorial](../TUTORIAL.md) explains the pricing options.

## Prepare your host

Use a host supported by upstream Kora. The example below uses Docker and Node.js to read the release file. A native installation uses the same configuration and signer files with the pinned Kora version.

From this repository's root:

```sh
mkdir -p work/my-provider
cp examples/operator/*.toml work/my-provider/
export KORA_IMAGE="$(node -p "JSON.parse(require('node:fs').readFileSync('examples/operator/kora-release.json','utf8')).image")"
docker pull "$KORA_IMAGE"
```

Edit `work/my-provider/kora.toml` to set your fee and transaction allowance. Keep the supplied basic-payment permissions. The 50% markup and 0.01 SOL allowance are examples.

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

docker run --rm --network none   -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   -v "$PWD/work/my-provider:/config:ro"   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml config validate --signers-config /config/signers.toml

docker run -d --name neiro-provider --restart unless-stopped   -p 127.0.0.1:8080:8080   -v "$PWD/work/my-provider:/config:ro"   -e RPC_URL -e JUPITER_API_KEY -e KORA_PRIVATE_KEY   --entrypoint kora "$KORA_IMAGE"   --config /config/kora.toml rpc start --signers-config /config/signers.toml
unset KORA_PRIVATE_KEY
```

Environment-backed keys remain accessible to the host/container administrator. Keep access to the host and Docker restricted. Put your HTTPS reverse proxy in front of local port 8080; cloud container hosts can supply their own HTTPS ingress. Use a public hostname intended for registry publication, with no credentials in its URL and no redirects. Retain rate limits and monitor RPC quotas. Direct requests still rely on Kora's policy and reimbursement checks.

## Register and verify

Follow [on-chain registration](REGISTRATION.md). This replaces the older HTTP `register-node.mjs` workflow. The operator signs locally; a router never receives its private key. Registration and renewal spend transaction fees and expose the registered endpoint and payer on Solana.

After publication, verify discovery and admission, then request a payer-pinned quote. Full payment tests must confirm the final on-chain result and reimbursement. A process starting or a quote succeeding is not a completed payment.

## Keep it running

```sh
docker ps --filter name=neiro-provider
docker restart neiro-provider
docker stop neiro-provider
```

After editing fees, validate and restart, then obtain a new quote. Monitor SOL liquidity, NEIRO holdings, RPC/Jupiter quotas, Kora health and registration expiry. Renew before expiry as described in REGISTRATION.md. Stop the service and publish a higher-revision revocation when leaving the network; stopping a process alone does not revoke its public record.
