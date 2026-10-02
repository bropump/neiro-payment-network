# Agent setup checklist

1. Read [configuration](../CONFIGURATION.md) and the pinned release file.
2. Confirm the host, operator-owned credentials, chosen pricing and spending allowance.
3. Follow [JOIN.md](JOIN.md) to validate and run stock Kora. Keep secrets private.
4. Use stable HTTPS with operator-managed limits. Temporary tunnel URLs are for testing and can expire.
5. Follow [REGISTRATION.md](REGISTRATION.md) for the Cloudflare HTTP enrollment flow.
6. Check `/operators`, request a pinned quote, and test payment only within an approved budget.
7. Return recoverable test funds/rent and provide startup, status, restart, monitoring and removal instructions.

Never describe successful startup or a quote as a finalized payment. Do not use the legacy Rust/on-chain registration helpers for this network.
