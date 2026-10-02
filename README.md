# NEIRO Kora Operators

Run stock [Kora](https://github.com/solana-foundation/kora) to sponsor Solana transaction fees and receive NEIRO reimbursement. You choose your hosting, wallet, fees and spending limits.

The [Cloudflare router](https://github.com/bropump/neiro-kora-router-cloudflare) gives apps one URL and selects available operators by response time or sample fee. Operators do not need to run a router.

## Get started

1. Follow [installation and startup](docs/JOIN.md) using the pinned official Kora image.
2. Choose your fee and per-transaction allowance in a private copy of `kora.toml`.
3. Fund your operator wallet and provide a stable public HTTPS endpoint.
4. [Register your URL](docs/REGISTRATION.md) with the router and verify a payment.

You need Docker or a supported native host, SOL funding, a NEIRO token account, a Solana RPC URL and the pricing credentials required by your Kora configuration. Keep wallet and API credentials on your host, outside Git and chat.

## Ask an agent to set it up

```text
Set up a NEIRO Kora operator on [my host]. Follow AGENTS.md and
 docs/JOIN.md. Help me choose fees and a spending limit. Keep credentials
private. Start the pinned stock Kora release, configure stable HTTPS,
then follow docs/REGISTRATION.md to join the Cloudflare router.
Verify a quote; only spend real funds within my approved test budget.
Give me the status, restart and shutdown commands.
```

## Know before funding

Operators pay SOL and receive NEIRO; reimbursement does not replenish SOL automatically. Registration does not guarantee traffic or profit. Failed transactions can cost SOL. Public endpoints need operator-managed request limits and security.

Read [configuration and sponsor exposure](CONFIGURATION.md) before using the broad-program template. The example fee and spending allowance are editable, not network requirements.

[Setup](docs/JOIN.md) · [Join or leave](docs/REGISTRATION.md) · [Configuration](CONFIGURATION.md) · [Test history](PLATFORM-TESTS.md)
