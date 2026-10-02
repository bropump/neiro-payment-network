# Set up and run the operator

You are setting up a working service for the user. Run the steps you can complete; do not hand back commands for the user to execute when you have the required access. Use [JOIN.md](JOIN.md) for Kora setup and [REGISTRATION.md](REGISTRATION.md) for the exact router calls. Do not patch Kora or its SDK.

## Get the few inputs you need

Inspect the host and existing operator first. Reuse prior choices and permissions. Bundle missing questions instead of asking at every step:

- Host access and intended public HTTPS hostname, including the ability to serve the verification file.
- Private references to the signer, Solana RPC and Jupiter credentials. Never request their values in chat.
- Fee choice: margin, fixed or free. Explain that 50% is the template example; 0.25 SOL is the recommended per-transaction allowance and 10 is the signature limit.
- Wallet funding and any authorized spending scope. Explain SOL goes out and NEIRO comes in; reimbursement does not automatically replenish SOL.

Offer [remote signing](SIGNING.md) as an optional way to isolate the key from the host. Preserve an existing signer choice. A new remote provider account may require the user's action; do not block local-keypair setup when that is their choice. If an input is missing, finish independent preparation and name the exact remaining step.

## Complete setup

1. Install unchanged official Kora at the latest successfully built upstream main revision, recording the revision and pinning the deployment. Follow upstream requirements for the host; [Docker helpers](DOCKER.md) are optional. Do not invent a CPU/RAM minimum or claim measured capacity.
2. Copy the NEIRO config into private storage and apply the selected fee and allowance. Configure the chosen signer using the exact Kora build's supported settings. Prepare the funded SOL payer and NEIRO reimbursement account within the user's spending authorization.
3. Validate the private config and start Kora under a service manager. Set up HTTPS and its static verification-file route. Keep transaction policies and request limits; do not weaken an existing private deployment automatically.
4. Register the endpoint, host the returned verification JSON and call verify. Save the registration ID and keep the proof available. Confirm the expected payer and `eligible: true` in `/operators`, allowing for cache refresh. No registration payment or renewal job is needed.
5. Obtain a quote for a valid intended transaction through `/rpc?operator=ID`. Keep the provider pinned. A quote is not a payment test. Use a private ledger for payment tests unless real spending is authorized; reconcile submitted signatures before any retry.
6. Install update checks every five minutes with absolute paths and private logs/state. Prevent overlapping updates. Validate before replacement, preserve settings and keys, retain rollback and check local health. Then call router verification with the saved ID, respecting its 60-second cooldown. The Docker updater does not make this router call itself: include it after successful replacement in the host workflow.
7. Run the installed update job once and confirm it exits successfully. Make failures visible in the host's service logs or existing monitoring. Confirm service restart works and the proof survives a restart/update. Do not report a scheduler as working merely because its file exists.

## Leave a short operating summary

Save a private runbook on the operator host and give the user its path. Include:

- Service name, public Kora URL, router URL and registration ID.
- Payer public key, chosen signer backend, fees, allowance and signature limit.
- Deployed upstream revision/digest and private config/secret-reference locations, never secret values.
- Exact status, logs, stop, restart, update and router-verification commands for this host.
- Update schedule, rollback instructions and where to see failures.
- How to check SOL liquidity and RPC/Jupiter quotas, change fees and remove registration.

Report what was actually verified: config validation, running Kora, expected payer, router eligibility, routed quote, service restart and scheduled update execution. List payment settlement separately if tested. If anything is incomplete, say so instead of calling the operator ready. The router checks compatibility and health; it does not enforce the latest upstream revision.
