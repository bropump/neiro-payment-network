# Router

The active router is [neiro-kora-router-cloudflare](https://github.com/bropump/neiro-kora-router-cloudflare).

Apps use `https://neiro-cf-router-demo.optical.workers.dev/rpc`, optionally with `?selection=fastest` or `?selection=cheapest`.

Operators run Kora independently and [register their HTTPS endpoint](REGISTRATION.md). They do not need to host a router. To run another router, follow the Cloudflare repository's deployment instructions; each deployment has its own operator directory.

The earlier Rust/on-chain registry is not the admission mechanism for this deployment.
