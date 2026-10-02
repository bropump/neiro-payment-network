# Using or hosting a router

Operators run Kora and [register their endpoint](REGISTRATION.md). Clients use the router's `/rpc` endpoint with their Kora integration. Neither needs to host a router.

The router is a separate [Cloudflare Workers project](https://github.com/bropump/neiro-kora-router-cloudflare). Its repository contains deployment requirements, client usage and operating limits. It forwards requests to eligible Kora operators; Kora holds the signer and validates sponsorship.

Current router: `https://neiro-cf-router-demo.optical.workers.dev`

- `/rpc?selection=fastest` or `/rpc?selection=cheapest`: Kora client endpoint.
- `/operators`: eligibility, pricing and timing information.
- `/healthz`: router health.

Prepare the transaction with the selected payer, approve the actual Kora quote and keep that provider pinned through submission. The router does not switch or retry signed payments automatically.
