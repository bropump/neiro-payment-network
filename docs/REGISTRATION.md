# Register with the Rust router

Kora serves transactions. The separate `neiro-router` CLI publishes your registration to Solana. You run the CLI on your own host; you do not need to start its gateway service.

## What you need

- A working public HTTPS Kora endpoint and its matching sponsor keypair, held locally.
- The reviewed Rust CLI source or a trusted build supplied by the network maintainer. This repository does not yet publish a router-source URL or downloadable CLI release. Do not substitute the older JavaScript router helper.
- A Solana RPC, the agreed genesis hash, registry namespace and anchor policy, plus a router URL for checking admission. Match the router you intend to join. The CLI default `neiro-kora-v1` is not proof of the deployed network's namespace.
- At least $1 each of SOL and NEIRO in the required payer accounts, supported Kora settings, and permission to spend the registration and renewal transaction fees.

`examples/operator/network.example.json` lists the inputs. Its null values must be supplied; it is not a working network profile. The anchor is normally derived from the namespace. If the network uses an explicit anchor, set that same value for publish, discover and gateway.

## Get the CLI

Inside the reviewed Rust router source checkout:

```sh
cargo build --locked --release --bin neiro-router
./target/release/neiro-router publish --help
./target/release/neiro-router discover --help
```

Install that binary on your PATH as `neiro-router`, or use its absolute path. CLI options were checked against the current Rust source and its local binary; see [router alignment](ROUTER-ALIGNMENT.md).

## Publish your registration

Load `NEIRO_RPC_URL`, `NEIRO_GENESIS_HASH`, `NEIRO_NAMESPACE`, `KORA_ENDPOINT`, `OPERATOR_KEYPAIR` and `REGISTRY_REVISION` in your private environment. Use `NEIRO_ANCHOR` only if the network specifies an override; otherwise leave it unset. Set the revision to a value greater than your previous publications. For a new payer with no prior record, start at 1.

```sh
: "${NEIRO_RPC_URL:?Set RPC}"
: "${NEIRO_GENESIS_HASH:?Set verified network genesis hash}"
: "${NEIRO_NAMESPACE:?Set the shared registry namespace}"
: "${KORA_ENDPOINT:?Set your intended public HTTPS Kora endpoint}"
: "${OPERATOR_KEYPAIR:?Set your local payer keypair path}"
: "${REGISTRY_REVISION:?Set a new increasing revision}"

neiro-router publish   --rpc-url "$NEIRO_RPC_URL"   --genesis-hash "$NEIRO_GENESIS_HASH"   --namespace "$NEIRO_NAMESPACE"   --keypair "$OPERATOR_KEYPAIR"   --endpoint "$KORA_ENDPOINT"   --revision "$REGISTRY_REVISION"   --ttl-seconds 86400
```

This submits a real Solana transaction and waits for finalization. Save its signature, revision and expiry privately. The record contains your payer, endpoint, network, namespace and validity period. Your endpoint and payer become public, including in permanent transaction history. Private keys and API credentials are never part of the record.

If the command times out after submission, keep the reported signature and reconcile its chain status before publishing another record.

## Check discovery and admission

```sh
neiro-router discover   --rpc-url "$NEIRO_RPC_URL"   --genesis-hash "$NEIRO_GENESIS_HASH"   --namespace "$NEIRO_NAMESPACE"

: "${NEIRO_ROUTER_URL:?Set a confirmed router base URL}"
curl --fail --silent --show-error "${NEIRO_ROUTER_URL%/}/readyz"
curl --fail --silent --show-error "${NEIRO_ROUTER_URL%/}/operators"
```

Find your payer in discovery, then in the router's admitted operator list. `/readyz` describes the router as a whole, not your individual admission. `/healthz` only reports process liveness. Background checks take time; fresh registration alone does not mean the operator can serve payments.

The router checks payer identity, funding, pricing, required methods and an unsigned account-creation quote. It uses public Kora endpoints without provider credentials. A protected endpoint that rejects its probes will not be admitted. No secret is distributed through the registry.

Use the Kora client with `${NEIRO_ROUTER_URL}/rpc?provider=YOUR_PAYER` to obtain an unsigned quote for a valid payment. Keep that same payer when preparing and submitting the final approved transaction. Test payments on a private ledger first; live execution needs an approved spending scope.

## Renew, change or leave

Records last at most 24 hours. Have your setup agent arrange one publisher to renew comfortably before expiry, for example every 12 hours with a 24-hour TTL. Persist a strictly increasing revision, prevent overlapping jobs, budget transaction fees and alert on failure. The CLI does not install a scheduler or manage revisions for you. Renewal needs access to the operator key on its own host, never inside a router.

To change your endpoint, publish the new endpoint at a higher revision. To revoke, use the same publish command with a higher revision and add `--disabled`. Wait for finalization and verify the record is no longer active. Publishing a replacement does not erase earlier public records.

Registration establishes the signing identity, not honesty or guaranteed availability. Routers independently check eligibility. Registry scans depend on Solana RPC history and can fail if spam exhausts their scan budget; see ROUTER-ALIGNMENT.md for the current prototype's scope.
