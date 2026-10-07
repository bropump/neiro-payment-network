# Keep every operator listing renewed

Every operator uses signed v5 listings anchored to a finalized Solana block. The supplied runner renews unchanged terms when 86400 chain seconds (24 hours) have elapsed since that anchor's block time. Clients reject the listing when 172800 seconds (48 hours) have elapsed. Readers enforce this fixed 48-hour lifetime; there is no operator-controlled expiry field. An operator may sign a fresh valid anchor sooner, while the supplied runner uses the daily cadence. Changed terms publish immediately after the running Kora endpoint and private configuration agree.

The SPL Record account remains onchain after expiry; expiry does not close it or refund rent. Readers reject old versions, including persistent v4. Migrate an existing account with the normal `publish` command before enabling renewal. This preserves its derived address, authority, rent and Kora deny entry. Keep official Kora and its SDK unchanged.

## Install the portable Node runner

Use Node.js 24 or later. From this repository:

```sh
cd tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
node runner.mjs --help
```

No Rust or native compilation is required for this path. Stock Kora remains unchanged; the Rust publisher is an optional reference. Set `SOLANA_RPC_URL` in the private service environment, and reuse the existing Kora configuration, signer configuration and signer environment variables.

The runner uses official JavaScript Keychain packages for memory, Turnkey, Privy, Vault and Openfort. All five adapters have mapping tests; only memory has live signer evidence. Remote provider integration must be verified for the actual deployment. Custom nonempty Kora `http_config` settings fail closed because the published JS factories cannot honor them. Remote signer creation and message signing have a 30-second caller deadline; a late result cannot be used by that failed call. No custom cryptographic signer is introduced.

Actions precede options: `node runner.mjs address`, `publish`, `renew`, `check`, `discover` or `close`. Use `--help` for supported options. `address` derives the listing without credentials; `discover` performs strict v5 RPC discovery. `check` compares the listing against the supplied live endpoint/configuration without sending a transaction, but still uses and reconciles the private state directory. Publication, renewal, checks and closure share `--state-dir`; the Node runner does not use the Rust `--journal` flag.

## One worker and persistent state

Prepare a private persistent directory owned by the operator's service user, with mode `0700`. Choose one worker per signer across all hosts and use the same directory for every run. A local directory lock cannot coordinate workers on separate machines. Do not use `/tmp`, discard a pending journal or switch directories to get around an unresolved transaction. The state directory must survive restart and redeployment.

When replacing an existing Rust worker, disable every old timer/service and verify that zero old worker processes remain **before** starting Node with the same persistent state directory. The two implementations have different lock mechanisms; their locks do not make concurrent operation safe. Retain `pending.json` and `finalized.json` through migration.

Run the following one-shot command from the private deployment directory. Replace every placeholder with the actual public key, URL and absolute paths, and supply the existing signer environment through the host's private service configuration:

```sh
/ABS/bin/node /ABS/tools/kora-publisher/script/runner.mjs renew --operator OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml --signers-config /PRIVATE/signers.toml --url https://OPERATOR_HOST/ --state-dir /PRIVATE/renewal
```

Add `--signer-name NAME` when required by the existing signer configuration. Do not put secrets in command arguments, scheduler examples or public logs. The worker creates `runner.lock` atomically and reconciles pending submissions before trying another operation. `pending.json` preserves the signature before sending; `finalized.json` preserves the finalized slot floor used to reject older RPC account snapshots. An unresolved send stops that attempt; investigate its saved signature and finalized account state rather than starting a second worker. Retain the directory across upgrades, reboot and container replacement.

A crash can leave `runner.lock`. It fails closed and has **no automatic host-clock expiry or stale-lock eviction**. Never remove it just because it is old. Only after the operator verifies the old process is dead may the lock directory be removed; retain `pending.json` and `finalized.json` and allow their reconciliation before further signing. Do not clear the entire state directory to recover a lock.

For the recommended single supervised service, append `--watch` to the command above. It runs once immediately, waits one hour between checks and repeats. Use the host's process supervisor to start it after reboot and restart it if it exits. Do not also create an hourly timer for the same signer. Alternatively, use the one-shot command without `--watch` with one of the native timers below.

Invoke the worker once an hour and once when its service starts. Hourly invocation does **not** mean hourly signing: unchanged terms before 24 chain hours cause no attestation signature or transaction. Each actual renewal uses a fresh finalized anchor and pays a network fee. The host timer only wakes the worker; finalized chain time controls renewal and expiry. Delayed wake-ups, unavailable RPC block history, signer failures, a sleeping host, chain stalls and insufficient SOL can prevent renewal. No timer guarantees continuous discovery eligibility.

Use the host's existing secret-loading mechanism. Where a private wrapper is needed, save it outside the repository, owned by the service user and mode `0700`; it should load the authorized private environment, set the private working directory and `exec` the exact command above. The examples below call that wrapper at `/PRIVATE/renew-listing`. They configure scheduling, not new publisher flags.

## macOS: launchd

For a logged-in service user, save a plist under that user's `~/Library/LaunchAgents/`; for operation independent of login, use an administrator-managed LaunchDaemon with the chosen service identity. Use absolute paths and create the private log directory first. Do not assume a LaunchAgent continues running after logout or while the Mac sleeps.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.neiro.listing-renew</string>
  <key>ProgramArguments</key><array><string>/PRIVATE/renew-listing</string></array>
  <key>WorkingDirectory</key><string>/PRIVATE</string>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>/PRIVATE/logs/renew.out</string>
  <key>StandardErrorPath</key><string>/PRIVATE/logs/renew.err</string>
</dict></plist>
```

Validate with `plutil -lint /ABS/com.neiro.listing-renew.plist`, then install it in the intended launchd domain using the host's normal `launchctl bootstrap` workflow. Record the exact `launchctl print` status and `launchctl bootout` stop commands for that domain. Do not configure a second LaunchDaemon for the same signer. `RunAtLoad` and `StartInterval` are standard [launchd plist keys](https://github.com/apple-oss-distributions/launchd/blob/main/man/launchd.plist.5).

## Linux: systemd

Save matching `neiro-listing-renew.service` and `neiro-listing-renew.timer` units in the host's system unit directory. Replace `neiro` and `/PRIVATE` with the established service identity and paths. Keep private credentials in the existing service secret mechanism or private wrapper.

```ini
# neiro-listing-renew.service
[Unit]
Description=Renew NEIRO operator listing
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=neiro
WorkingDirectory=/PRIVATE
ExecStart=/PRIVATE/renew-listing
UMask=0077
```

```ini
# neiro-listing-renew.timer
[Unit]
Description=Check NEIRO listing renewal hourly

[Timer]
OnBootSec=1min
OnUnitInactiveSec=1h
Unit=neiro-listing-renew.service

[Install]
WantedBy=timers.target
```

After replacing placeholders, use `systemctl daemon-reload` and `systemctl enable --now neiro-listing-renew.timer`. Inspect `systemctl list-timers neiro-listing-renew.timer` and `journalctl -u neiro-listing-renew.service`. `OnBootSec` and `OnUnitInactiveSec` are [monotonic systemd timer settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html); they schedule checks relative to boot and the prior run's completion. The worker independently decides whether renewal is due. To retire, disable the timer with `systemctl disable --now neiro-listing-renew.timer`, wait for the active service to finish and reconcile pending state before closing.

## Containers and other service managers

Use the existing container scheduler or a single supervised worker service to invoke the same one-shot command hourly. Mount the private configuration and signer environment using the deployment's secret mechanism, and mount `/PRIVATE/renewal` on persistent storage owned by the worker's user. Keep one replica; do not embed the worker in every Kora replica. Preserve state when replacing a container. [Optional container packaging](../tools/kora-publisher/container/) can host the same script; it is not required for native Node operation. For Bunny deployments with Kora in three regions, run one separate private worker application, not a sidecar in each Kora replica. This is deployment guidance, not a claim that a Node worker is already deployed on Bunny.

For a long-running container, use the same Node command with `--watch` as the single supervised process; the built-in loop performs the hourly checks. Forward termination signals, retain failure logs and let the platform restart it after host/container restart. A timer or wait duration is only a wake-up mechanism; it must never replace the publisher's finalized-chain checks. Document the platform's exact start, status, log and stop commands in the private operating note.

## Verify, monitor and retire

After the first run, read the finalized record through the strict client, independently fetch its signed anchor, and check the remaining 48-hour lifetime. Verify the service or timer is enabled, the worker can still reach the live Kora endpoint and signer, its SOL covers future transaction fees, and its persistent state is accessible after restart. Monitor renewal failures and remaining chain-time validity before expiry. An unexpired record still requires a responsive endpoint, sufficient operator balance and independently verified live quotes.

Before manual publication, coordinate with the sole renewal worker. Before retirement, disable its timer/service on every configured host, wait for an active run to finish, and reconcile pending submissions. Then run `node /ABS/tools/kora-publisher/script/runner.mjs close --operator OPERATOR_PUBLIC_KEY --signers-config /PRIVATE/signers.toml --state-dir /PRIVATE/renewal` with the same persistent state and verify finalized closure and returned rent. A running worker may otherwise recreate the account. Preserve Kora's deny entry until it is no longer needed; it also protects future recreation at the same address.
