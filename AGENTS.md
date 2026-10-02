# Set up a NEIRO operator

This repository supplies configuration and guidance for unchanged upstream Kora. Read docs/AGENT-SETUP.md, docs/JOIN.md and docs/REGISTRATION.md. Operators run Kora and register their HTTPS endpoint with the Cloudflare router.

Use the latest successfully built official upstream main revision. Pin each running deployment and arrange update checks every five minutes. Optional Docker helpers resolve upstream's image directly; NEIRO does not distribute a separate Kora build. Validate private config before replacement, preserve operator fees/allowances and signer identity, keep rollback available, check local health and call router verification after an upgrade. Do not patch Kora or its SDK.

Registration uses POST /operators/register, a hosted HTTPS verification JSON file and POST /operators/verify. Save the registration ID and keep the proof available. No wallet key goes to the router, and no registration payment or renewal job is needed. Follow docs/REGISTRATION.md for removal and identity changes.

Offer a supported remote signer through Kora’s existing solana-keychain integration as an optional recommendation; see docs/SIGNING.md. Local keypairs remain supported. Reuse an existing signer choice and never silently migrate wallets.

Keep keys and credentials in private storage, outside chat and Git. The router uses public Kora endpoints without provider API credentials; retain Kora's policies and request limits. Do not remove authentication from an existing private deployment automatically. Test on a private ledger unless real spending is authorized.

Execute setup when access is available, reuse prior decisions and bundle missing questions. Verify service restart and an actual scheduled update-job run. Finish with separate startup, eligibility, quote and payment results plus a private host runbook containing status, update, stop and restart instructions. Report incomplete steps clearly.
