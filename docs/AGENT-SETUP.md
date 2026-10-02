# Agent setup

1. Read [JOIN.md](JOIN.md) and [REGISTRATION.md](REGISTRATION.md). Reuse the user's chosen host, fee and allowance; ask only for missing inputs.
2. Install unchanged official Kora at the latest successfully built upstream main revision. Use the NEIRO config and signer templates in private storage. Use upstream's host requirements; our [Docker helpers](DOCKER.md) are optional.
3. Obtain private references to the signer, RPC and Jupiter credentials. Prepare the funded SOL payer and NEIRO reimbursement account. Keep keys out of chat, Git and router requests.
4. Validate the config and start Kora. Arrange HTTPS, service restart and the static verification-file path on the operator's hostname. Keep transaction policies and request limits; do not weaken an existing private deployment automatically.
5. POST the endpoint to `/operators/register`, host the returned verification JSON, then POST its ID to `/operators/verify`. Save the ID. Check eligibility and an operator-pinned quote. Registration has no Solana fee or renewal job.
6. Arrange upstream main update checks every five minutes. Pin each deployment, validate before replacement, preserve settings and keys, retain rollback, and check local Kora health. After an upgrade, call router verification again, respecting its 60-second cooldown. The Docker updater does not make that router call itself; arrange it in the host workflow.
7. Test payments on a private ledger unless real spending is authorized. Report startup, router eligibility, quote and settlement results separately.
8. Leave the private config location, deployed upstream revision/digest, chosen fees/allowance, registration ID, update schedule and host-specific status/stop/restart commands. Explain how to remove the registration.

Operators run Kora. They do not need to host a router. Do not patch Kora or its SDK.
