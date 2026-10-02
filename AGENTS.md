# Set up a NEIRO operator

Use unchanged official Kora pinned in `examples/operator/kora-release.json`. Follow `docs/JOIN.md`, review `CONFIGURATION.md`, and let the operator choose fees and spending limits in a private configuration copy.

The current network entry point is the Cloudflare router. Register the public HTTPS endpoint through the HTTP ownership-proof flow in `docs/REGISTRATION.md`. No on-chain registration, wallet signature, daily renewal or Rust router is required for this network. Legacy registry examples/scripts are not part of this setup.

Keep keys and API credentials on the operator's host, outside chat and Git. Do not remove authentication from an existing service silently: prepare an intentional public Kora endpoint with the operator's chosen policy and request limits.

Validate configuration, verify startup and public access, register, and obtain a routed quote. A quote is not proof a payment will be accepted. Spend real funds only within the operator's explicit scope, reconcile uncertain submissions before retrying, and report any unrecovered funds or rent. Provide status, restart, shutdown and removal instructions.
