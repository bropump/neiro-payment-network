# Current router integration

Use the [Cloudflare router](https://github.com/bropump/neiro-kora-router-cloudflare) and [HTTP registration](REGISTRATION.md).

- Operator: stock Kora, public HTTPS, operator-owned wallet/RPC and pricing.
- Router: discovers registered endpoints, checks advertised configuration, measures responses and forwards JSON-RPC unchanged.
- Client: checks the actual quote and transaction before signing, then keeps the payer pinned.

The router holds no operator wallet/API keys and does not enforce transaction sponsorship policy. The legacy Rust registry review and related examples describe an earlier architecture.
