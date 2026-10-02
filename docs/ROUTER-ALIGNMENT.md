# Router compatibility

The current router is [neiro-kora-router-cloudflare](https://github.com/bropump/neiro-kora-router-cloudflare). The operator flow is documented in [REGISTRATION.md](REGISTRATION.md).

| Concern | Current behavior |
| --- | --- |
| Join | HTTP register, hosted HTTPS proof, HTTP verify |
| Updates | Run the Kora upgrade on the operator host, then verify again |
| Registration lifetime | Keep the proof available; no periodic renewal |
| Credentials | Public endpoint; no sponsor key or provider API key sent to the router |
| Checks | Proof, payer/payment identity, required methods, NEIRO support; background sample quotes |
| Funding | Operator supplies SOL liquidity; no router dollar-balance threshold |
| Software version | Latest upstream main is the operator recommendation, not an enforced router admission rule |
| Payments | Original request/response forwarded; keep the payer pinned |

`getConfig` exposes reported settings; it does not prove a deployed image digest. Eligibility does not prove funding for every payment or compatibility with every application. See the router's [operating reference](https://github.com/bropump/neiro-kora-router-cloudflare/blob/main/docs/OPERATIONS.md) for checks and cache timing.
