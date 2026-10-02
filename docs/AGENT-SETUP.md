# Set up and run the operator

You are setting up a working service for the user. Run the steps you can complete; do not hand back commands for the user to execute when you have the required access. Use [JOIN.md](JOIN.md) for Kora setup and [REGISTRATION.md](REGISTRATION.md) for the exact router calls. Do not patch Kora or its SDK.

## Help the user choose where and how to run it

Start with their experience and preferred host. If they are unsure, explain a personal computer, a server and a managed cloud host in plain language: their computer must stay awake and online; a server needs maintenance; a managed host handles some infrastructure but has its own costs and limits. Help choose based on budget, uptime needs and comfort with maintenance. Do not assume they already have hosting, a domain or credentials.

Explain each stage briefly before doing it and why it is needed. Guide user-only steps such as account creation and secret entry. Perform authorized work when access is available, without making the user approve every routine command.

## Get the few inputs you need

Inspect the host and existing operator first. Reuse prior choices and permissions. Bundle missing questions instead of asking at every step:

- Host access and intended public HTTPS hostname, including the ability to serve the verification file.
- Private references to the signer, Solana RPC and Jupiter credentials. Never request their values in chat.
- Fee choice: margin, fixed or free. Explain that 50% is the template example; 0.25 SOL is the recommended per-transaction allowance and 10 is the signature limit.
- Wallet funding and any authorized spending scope. Explain SOL goes out and NEIRO comes in; reimbursement does not automatically replenish SOL.

Offer [remote signing](SIGNING.md) as an optional way to isolate the key from the host. Preserve an existing signer choice. A new remote provider account may require the user's action; do not block local-keypair setup when that is their choice. If an input is missing, finish independent preparation and name the exact remaining step.

## Stage 1: get a working operator

Use one host, one private config folder and one signer. Choose the simplest supported installation for that host. Do not require Docker, a service manager, a scheduler or a remote signer before the first working quote. Explain funding, RPC access, Jupiter credentials and public HTTPS/proof hosting up front; these are the real prerequisites.

1. Install unchanged official Kora at the latest successfully built upstream main revision, recording the revision and pinning the deployment. Follow upstream requirements for the host; [Docker helpers](DOCKER.md) are optional. Do not invent a CPU/RAM minimum or claim measured capacity.
2. Copy the NEIRO config into private storage and apply the selected fee and allowance. Configure the chosen signer using the exact Kora build's supported settings. Prepare the funded SOL payer and NEIRO reimbursement account within the user's spending authorization.
3. Validate the private config and start Kora in the foreground for the initial check. Set up HTTPS and its static verification-file route. Keep transaction policies and request limits; do not weaken an existing private deployment automatically.
4. Register the endpoint, host the returned verification JSON and call verify. Save the registration ID and keep the proof available. Confirm the expected payer and `eligible: true` in `/operators`, allowing for cache refresh. No registration payment or renewal job is needed.
5. Run the [unsigned routed quote check](REGISTRATION.md#check-a-routed-quote) for the first milestone. Then obtain a quote for the intended transaction through `/rpc?operator=ID` before any actual payment. Keep the provider pinned. A quote is not a payment test. Use a private ledger for payment tests unless real spending is authorized; reconcile submitted signatures before any retry.

## Stage 2: make it suitable to leave running

After the routed quote succeeds, show the user the working result. Then complete service restart, update scheduling and the operating guide. Do not describe the foreground-only setup as ready for unattended operation.

1. Install a host service manager for Kora and the HTTPS/proof service. Keep the same private config folder and signer.
2. Install update checks every five minutes with absolute paths and private logs/state. Prevent overlapping updates. Validate before replacement, preserve settings and keys, retain rollback and check local health. Then call router verification with the saved ID, respecting its 60-second cooldown. The Docker updater does not make this router call itself: include it after successful replacement in the host workflow.
3. Run the installed update job once and confirm it exits successfully. Make failures visible in the host's service logs or existing monitoring. Confirm service restart works and the proof survives a restart/update. Do not report a scheduler as working merely because its file exists.

## Leave a short operating summary

Show the user how to check the service, read a useful log entry and recognize a successful router verification. Explain when to replenish SOL and how to change fees. Do not merely hand over a list of unexplained commands.

Save a short private operating guide on the host and give the user its path. For each command, explain what it does and what a successful result looks like. Include:

- Service name, public Kora URL, router URL and registration ID.
- Payer public key, chosen signer backend, fees, allowance and signature limit.
- Deployed upstream revision/digest and private config/secret-reference locations, never secret values.
- Exact status, logs, stop, restart, update and router-verification commands for this host.
- Update schedule, rollback instructions and where to see failures.
- How to check SOL liquidity and RPC/Jupiter quotas, change fees and remove registration.

Report what was actually verified: config validation, running Kora, expected payer, router eligibility, routed quote, service restart and scheduled update execution. List payment settlement separately if tested. If anything is incomplete, say so instead of calling the operator ready. The router checks compatibility and health; it does not enforce the latest upstream revision.
