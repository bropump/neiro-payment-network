# Agent checklist: complete the README setup

Use the [main README](../README.md#set-up-your-operator) as the single installation guide. Carry all nine steps through from an empty host to the finish checks; do not hand back a pile of alternative installers. Use existing permissions, fees and signer choices. Ask only for missing host access, signer, endpoint or spending limits. Keep official Kora and its SDK unchanged.

## Before publication

For a new host, install official Kora and Node, set up RPC/Jupiter credentials and HTTPS, create or select the dedicated signer, copy private templates, and choose the operator's fees. The main README is the ordered path; do not treat a running Kora service or funded wallet as prerequisites the user must already have.

- Record the README's required inputs before starting. Use the [standard RPC path](../README.md#free-rpc-options): reuse working access, otherwise Helius if the user has not chosen another provider. Complete any required login/verification, store the full mainnet RPC URL privately, and obtain or reuse the Jupiter key required by stock Kora. A public keyless Jupiter response does not prove Kora can quote without a key.
- Treat Quicknode x402 as an advanced integration when requested or already available. This repository supplies no adapter installer. Verify mainnet genesis, finalized block/account reads, `getProgramAccounts`, unsigned simulation and Kora NEIRO quoting through the actual adapter. Supervise it, preserve its wallet/session state, and verify authentication refresh and credit replenishment within the authorized budget. Include it in restart, monitoring and end-to-end payment checks. Report monthly renewal as unverified until observed.
- Establish whether this is a retained operator or a temporary test. Do not advertise an existing test service as production by assumption.
- Locate the actual private `kora.toml`, `signers.toml`, signer environment, public signer and HTTPS endpoint. For a new deployment, use the repository templates and upstream Kora installation instructions. Choose the user's fees; do not silently adopt the example 50% margin.
- Set and verify both spending limits in live `getConfig`: the template uses `max_allowed_lamports = 250000000` and `max_priority_fee_lamports = 100000`. The first checks modeled sponsor outflow and network fees separately, not as a combined budget. Size it for sponsored account rent and the intended workload; preserve deliberate operator overrides. Explain that landed failures still charge network fees and roll back NEIRO reimbursement. A margin is not loss insurance.
- Check the priority cap on the signing path with a bounded sign-only request just above the chosen cap. Require a priority-limit rejection; a returned quote does not prove admission. Never broadcast an unexpectedly signed probe. Confirm a within-cap control is not rejected by the priority limit; other payment and policy checks still apply.
- Check SOL funding and the NEIRO fee-receipt account. A listing needs SOL fees and refundable account rent; it does not require a NEIRO deposit. Never print keys or copy them into this repository.
- Install Node 24+ and the locked script dependencies with install scripts disabled, as in the README.
- Run `protect` against the actual Kora config. Inspect its reported listing address and backup. Apply the change to every deployment copy used by public Kora instances sharing that key, then restart them. Editing a local file does not update a remote service.
- Verify live `getConfig` and `getPayerSigner` match the signer, payment destination, NEIRO acceptance, fees and blocked listing. Check enabled signing methods reject a bounded, non-destructive request touching the listing specifically because of the deny rule. An authentication failure or disabled method is not proof of account protection. One endpoint cannot prove every replica is protected. Before the listing exists, a Record write can fail simulation merely because its account is absent. Use an otherwise valid, harmless transaction that includes the listing as a read-only account; try the sign-only method first and never broadcast an unexpectedly accepted probe. Require the error to identify that blocked account.

## Publish and keep running

Start the README's `renew --watch` command with the existing private signer environment and one private persistent state directory. It handles initial creation and daily renewal; do not add a separate daily signing job. Install it as one supervised service. Verify Kora and the runner restart through their service managers, preserve state, and start after reboot. Configure service-failure, low-SOL and renewal alerts. Keep it separate from multi-region Kora replicas.

Confirm finalized publication (or an authenticated unchanged listing), read the record through RPC, verify its signature and chain anchor, and check direct discovery. Publication is not a payment test. The finish checks require a tiny direct payment within the user-authorized recipient, amount and fee limits; if authorization or funds are missing, leave that check explicitly incomplete. Verify the exact transaction, finality and balance changes. Recover eligible test accounts and funds as requested; never close pre-existing ATAs. Keep the operational listing unless the user requested a temporary test or retirement.

Before replacing an older Rust worker, stop it everywhere and verify zero old processes before Node uses the same persistent state. Do not delete `pending.json` or `finalized.json`. The implementations have different locks. See [recovery](RENEWAL.md#when-a-check-fails).

## Finish with a short operating note

For each README finish check, report **PASS**, **FAIL** or **NOT RUN**, with the command/result or finalized transaction receipt that supports it. A quote or unsigned simulation is not a completed payment; a running terminal is not a supervised service.

Give the user the public signer, listing and endpoint; first publication signature/cost; checks that passed; any remaining issue; and their exact service start/status/stop commands. Record private config/state paths without credential values. Link the [update instructions](RENEWAL.md#change-fees-or-update-the-script).

Node adapters exist for memory, Turnkey, Privy, Vault and Openfort. Only memory has live integration evidence; remote configurations still need verification with the chosen provider. Unsupported signer options fail closed. Preserve the user's signer and recovery access rather than changing custody to make setup pass.
