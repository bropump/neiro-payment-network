# Agent checklist: complete the README setup

Use the [main README](../README.md#set-up-your-operator) as the single installation guide. Carry it through on the user's chosen host; do not hand back a pile of alternative installers. Use existing permissions, fees and signer choices. Ask only for missing host access, signer, endpoint or spending limits. Keep official Kora and its SDK unchanged.

## Before publication

- Establish whether this is a retained operator or a temporary test. Do not advertise an existing test service as production by assumption.
- Locate the actual private `kora.toml`, `signers.toml`, signer environment, public signer and HTTPS endpoint. For a new deployment, use the repository templates and upstream Kora installation instructions. Choose the user's fees; do not silently adopt the example 50% margin.
- Check SOL funding and the NEIRO fee-receipt account. A listing needs SOL fees and refundable account rent; it does not require a NEIRO deposit. Never print keys or copy them into this repository.
- Install Node 24+ and the locked script dependencies with install scripts disabled, as in the README.
- Run `protect` against the actual Kora config. Inspect its reported listing address and backup. Apply the change to every deployment copy used by public Kora instances sharing that key, then restart them. Editing a local file does not update a remote service.
- Verify live `getConfig` and `getPayerSigner` match the signer, payment destination, NEIRO acceptance, fees and blocked listing. Check enabled signing methods reject a bounded, non-destructive request touching the listing specifically because of the deny rule. An authentication failure or disabled method is not proof of account protection. One endpoint cannot prove every replica is protected.

## Publish and keep running

Start the README's `renew --watch` command with the existing private signer environment and one private persistent state directory. It handles initial creation and daily renewal; do not add a separate daily signing job. Install it as one supervised service and verify its restart policy. Keep it separate from multi-region Kora replicas.

Confirm finalized publication (or an authenticated unchanged listing), read the record through RPC, verify its signature and chain anchor, and check direct discovery. Publication is not a payment test: only make a tiny live payment if the user authorized recipient, amount and fee limits; verify the exact transaction, finality and balance changes. Recover eligible test accounts and funds as requested; never close pre-existing ATAs. Keep the operational listing unless the user requested a temporary test or retirement.

Before replacing an older Rust worker, stop it everywhere and verify zero old processes before Node uses the same persistent state. Do not delete `pending.json` or `finalized.json`. The implementations have different locks. See [recovery](RENEWAL.md#when-a-check-fails).

## Finish with a short operating note

Give the user the public signer, listing and endpoint; first publication signature/cost; checks that passed; any remaining issue; and their exact service start/status/stop commands. Record private config/state paths without credential values. Link the [update instructions](RENEWAL.md#change-fees-or-update-the-script).

Node adapters exist for memory, Turnkey, Privy, Vault and Openfort. Only memory has live integration evidence; remote configurations still need verification with the chosen provider. Unsupported signer options fail closed. Preserve the user's signer and recovery access rather than changing custody to make setup pass.
