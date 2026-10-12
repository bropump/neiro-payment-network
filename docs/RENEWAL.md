# Run and maintain your listing

For installation, use the [operator procedure in AGENTS.md](../AGENTS.md). The recommended setup is **one supervised `renew --watch` process per operator signer**. It creates the listing on its first run, then checks hourly. Unchanged terms renew after 24 chain hours; clients reject them after 48 hours. The host clock only schedules checks.

## Keep the worker running

Use the host's existing service manager: systemd on Linux, launchd on macOS, or the platform's container service. Configure it to run the exact `renew --watch` command from AGENTS.md with absolute paths, the private signer environment, persistent state, and startup after reboot. On Bunny, use one private worker with a persistent volume; do not add a renewal worker to every regional Kora replica.

A terminal session alone does not provide that supervision. Your setup agent should install the service and leave the exact status, log, restart and stop commands for your host. There is no second daily job: `--watch` handles the checks.

Keep the state directory owned by the service user, private (0700 on Unix) and on durable storage. The runner creates a missing directory. Preserve it across restarts and updates; do not use an ephemeral container directory. On Windows, directory fsync is unavailable through Node, so sudden-power-loss durability is not claimed; durable Unix storage is recommended for unattended production use.

If you already use a native hourly job, it may invoke `renew` without `--watch` instead. Use one scheduling method, not both.

## Check that it is working

- `"status":"finalized"` includes the transaction signature for a completed publication.
- `"status":"unchanged"` means no renewal is due and no transaction was sent.
- A journaled signature alone is not finality. Confirm its result before treating the listing as updated. `status:error` includes a safe error code and retry interval; raw credential-bearing RPC and signer errors are not logged.

Monitor the last successful onchain renewal, not just whether the process is running. Alert when the signed anchor is 30 hours old, leaving 18 hours before expiry, and verify that alert reaches the operator. Also monitor service errors and the operator's SOL. RPC outages, a sleeping host, signer errors or lack of SOL can prevent renewal. A current listing does not prove continuous uptime or honest quotes.

## Change fees or update the script

**Fees/config:** edit the private Kora config, restart all relevant Kora instances, then restart the sole listing worker to check immediately. Use the same files and state. Changed terms publish when live Kora matches. The listing address and deny entry remain the same.

**Script update:** stop the worker and wait for it to exit. Update to the chosen reviewed repository revision, run `npm ci --ignore-scripts --registry=https://registry.npmjs.org` in the script directory, then start the same service with the same state. Do not run the old and new workers together.

**Moving from Rust:** stop every old Rust worker and verify no process remains before starting Node on the same state directory. Keep `pending.json`, `finalized.json` and saved receipts. The two implementations have different locks.

## When a check fails

**Config check:** check the URL, signer, payment address, fees and deny entry. Run `protect` on the actual Kora config if needed, then restart every relevant Kora instance. Editing a local copy does not update a remote deployment. Do not weaken authentication or signing policies to make a check pass.

**Pending transaction:** the runner saves the exact signed transaction, blockhash, last valid block height and identity before sending. On restart it checks the saved signature first. While valid it re-sends only those same bytes, without signing again. Once a finalized block proves expiry, it rechecks historical status and the record before archiving an unobserved attempt and preparing a fresh renewal. RPC failure, stale responses or conflicting evidence preserve the journal. `check` never submits a transaction.

Successful and failed finalized transactions are archived with their outcome. A finalized failure reports `TRANSACTION_FINALIZED_FAILED` and the watch loop waits an hour before another attempt; network fees on failed transactions are not refundable. Pending confirmation, send RPC errors and legacy expiry waits retry after one minute. Other errors retry hourly. `finalized.json` preserves the minimum accepted chain slot. Never delete the receipt or switch state directories to force another signature.

Useful error codes:

| Code | Action |
| --- | --- |
| `PENDING_STILL_VALID` / `CONFIRMATION_TIMEOUT` | Keep the worker running; it reconciles/retries the same attempt. |
| `RPC_*` | Check the named RPC method/provider; credentials remain private. |
| `TRANSACTION_FINALIZED_FAILED` | Inspect the public signature's transaction error before the next hourly retry. |
| `RPC_EXPIRY_CONFLICT` / `PENDING_NOT_FINALIZED` | Preserve state; the RPC evidence is inconsistent or not finalized. |
| `STATE_EEXIST` | Check for another worker or an orphan lock; see below. |
| `LEGACY_RECOVERY_REQUIRED` | Follow the guarded migration below. |
| `VALIDATION_OR_SIGNER_FAILED` | Check signer/config and state integrity privately; no raw secret-bearing exception is printed. |

### Recover an old journal without lifetime data

Older runners saved only `{record, genesis, signature}`. Updating does not silently discard these receipts. Finalized results can still reconcile automatically; a missing signature requires an explicit recovery assertion.

1. Stop all old workers. Preserve the state volume and identify the exact pending signature from its journal or the old worker's `journaled` log.
2. Establish a **trusted finalized slot after that transaction was signed** using deployment/log evidence and chain data. This is an operator assertion that the attempt came from the old publisher, used a recent blockhash from no later than that slot, and did **not** use a durable nonce. A null transaction lookup alone is insufficient. Do not use this route for unknown transactions.
3. Start the same worker/state with `--recover-legacy-signature SIGNATURE --recover-legacy-before-slot FINALIZED_SLOT` added to its normal `renew --watch` command. Container deployments can set `RECOVER_LEGACY_SIGNATURE` and `RECOVER_LEGACY_BEFORE_SLOT` instead.
4. The runner waits until more than 160 produced finalized blocks have passed the cutoff, rechecks historical status and the record, and retains the original receipt plus recovery evidence before renewing. Unavailable or conflicting RPC evidence keeps it blocked.
5. Verify the replacement finalized and is independently discoverable. Remove the two migration options afterward. They match only that exact old signature and do not relax validation for later attempts.

**Crash lock:** Node uses a `runner.lock` directory. Normal completion releases it; a forced crash can leave it. First verify the previous process is dead on every host. Preserve and reconcile any pending transaction, then remove only the orphan lock directory and restart. There is deliberately no clock-based lock expiry.

## Stop operating and recover rent

Stop the renewal service and wait for its process to exit. Resolve any pending transaction, then run from the script directory:

```sh
node runner.ts close --operator YOUR_OPERATOR_PUBLIC_KEY --signers-config /PRIVATE/signers.toml --state-dir /PRIVATE/renewal
```

Verify finalized closure. Record rent returns to the operator; network fees cannot be refunded. No ATAs or tokens are involved. Keep the Kora deny entry if the same listing could be recreated later. A running renewal worker would recreate a closed listing, which is why it must be stopped first.
