# Run and maintain your listing

For installation, use the [operator setup guide](OPERATOR-SETUP.md). The recommended setup is **one supervised `renew --watch` process per operator signer**. It creates the listing on its first run, then checks hourly. Unchanged terms renew after 24 chain hours; clients reject them after 48 hours. The host clock only schedules checks.

## Keep the worker running

Use the host's existing service manager: systemd on Linux, launchd on macOS, or the platform's container service. Configure it to run the exact README command with absolute paths, the private signer environment, persistent state, and startup after reboot. On Bunny, use one private worker with a persistent volume; do not add a renewal worker to every regional Kora replica.

A terminal session alone does not provide that supervision. Your setup agent should install the service and leave the exact status, log, restart and stop commands for your host. There is no second daily job: `--watch` handles the checks.

Keep the state directory owned by the service user, private (0700 on Unix) and on durable storage. The runner creates a missing directory. Preserve it across restarts and updates; do not use an ephemeral container directory. On Windows, directory fsync is unavailable through Node, so sudden-power-loss durability is not claimed; durable Unix storage is recommended for unattended production use.

If you already use a native hourly job, it may invoke `renew` without `--watch` instead. Use one scheduling method, not both.

## Check that it is working

- `"status":"finalized"` includes the transaction signature for a completed publication.
- `"status":"unchanged"` means no renewal is due and no transaction was sent.
- A journaled signature alone is not finality. Confirm its result before treating the listing as updated.

Monitor service errors, remaining 48-hour chain validity and the operator's SOL. RPC outages, a sleeping host, signer errors or lack of SOL can prevent renewal. A current listing does not prove continuous uptime or honest quotes.

## Change fees or update the script

**Fees/config:** edit the private Kora config, restart all relevant Kora instances, then restart the sole listing worker to check immediately. Use the same files and state. Changed terms publish when live Kora matches. The listing address and deny entry remain the same.

**Script update:** stop the worker and wait for it to exit. Update to the chosen reviewed repository revision, run `npm ci --ignore-scripts --registry=https://registry.npmjs.org` in the script directory, then start the same service with the same state. Do not run the old and new workers together.

**Moving from Rust:** stop every old Rust worker and verify no process remains before starting Node on the same state directory. Keep `pending.json`, `finalized.json` and saved receipts. The two implementations have different locks.

## When a check fails

**Config check:** check the URL, signer, payment address, fees and deny entry. Run `protect` on the actual Kora config if needed, then restart every relevant Kora instance. Editing a local copy does not update a remote deployment. Do not weaken authentication or signing policies to make a check pass.

**Pending transaction:** inspect the signature saved in `pending.json` through a trusted finalized RPC. The runner reconciles successful finalized submissions; an ambiguous or failed send requires investigation. Never delete the receipt or switch state directories to force another signature. `finalized.json` preserves the minimum chain slot accepted after a prior publication.

**Crash lock:** Node uses a `runner.lock` directory. Normal completion releases it; a forced crash can leave it. First verify the previous process is dead on every host. Preserve and reconcile any pending transaction, then remove only the orphan lock directory and restart. There is deliberately no clock-based lock expiry.

## Stop operating and recover rent

Stop the renewal service and wait for its process to exit. Resolve any pending transaction, then run from the script directory:

```sh
node runner.ts close --operator YOUR_OPERATOR_PUBLIC_KEY --signers-config /PRIVATE/signers.toml --state-dir /PRIVATE/renewal
```

Verify finalized closure. Record rent returns to the operator; network fees cannot be refunded. No ATAs or tokens are involved. Keep the Kora deny entry if the same listing could be recreated later. A running renewal worker would recreate a closed listing, which is why it must be stopped first.
