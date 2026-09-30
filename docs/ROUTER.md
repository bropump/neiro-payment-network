# Running a router is optional

A Kora operator pays SOL and receives NEIRO. A Rust router discovers operators and forwards payment requests. Run either one, or both as separate services. Do not give the gateway process a sponsor key. Hosting a router alone does not earn the Kora operator payment.

Obtain the reviewed Rust source from the maintainer. Build it with `cargo build --locked --release --bin neiro-router`. Registration and gateway hosts must agree on the genesis hash, namespace and anchor. Each gateway supplies its own RPC and a compatible price feed.

```sh
: "${NEIRO_RPC_URL:?Set RPC}"
: "${NEIRO_GENESIS_HASH:?Set verified network genesis hash}"
: "${NEIRO_NAMESPACE:?Set shared namespace}"
: "${NEIRO_PRICE_URL:?Set approved USD price endpoint}"
NEIRO_LISTEN=127.0.0.1:8081 neiro-router gateway
```

The example uses port 8081 so a co-hosted Kora can use 8080. Set up HTTPS ingress and a service manager for the host. `/healthz` is liveness; `/readyz` indicates readiness; `/operators` lists admitted operators; `/rpc` provides the supported Kora RPC flow. The router does not install Kora or fund wallets.

The current public profile has no provider credential store. Registration is on Solana, not a gateway POST endpoint. The router has no sponsor signing key and does not simulate payment transactions; Kora retains sponsorship validation. Apps still approve fees and verify settlement independently. See [the reviewed compatibility notes](ROUTER-ALIGNMENT.md).
