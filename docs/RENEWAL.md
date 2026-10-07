# Keep every operator listing renewed

Every operator uses signed v5 listings anchored to a finalized Solana block. Unchanged terms renew when 86400 chain seconds (24 hours) have elapsed since that anchor's block time. Clients reject the listing when 172800 seconds (48 hours) have elapsed. An operator cannot choose a longer expiry or a different renewal period. Changed terms publish immediately after the running Kora endpoint and private configuration agree.

The SPL Record account remains onchain after expiry; expiry does not close it or refund rent. Readers reject old versions, including persistent v4. Migrate an existing account with the normal `publish` command before enabling renewal. This preserves its derived address, authority, rent and Kora deny entry. Keep official Kora and its SDK unchanged.

## One worker and persistent state

Prepare a private persistent directory owned by the operator's service user, with mode `0700`. Choose one worker per signer across all hosts and use the same directory for every run. A local directory lock cannot coordinate workers on separate machines. Do not use `/tmp`, discard a pending journal or switch directories to get around an unresolved transaction.

Run the following one-shot command from the private deployment directory. Replace every placeholder with the actual public key, URL and absolute paths, and supply the existing signer environment through the host's private service configuration:

```sh
/ABS/bin/neiro-kora-publisher --operator OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml --signers-config /PRIVATE/signers.toml renew --url https://OPERATOR_HOST/ --state-dir /PRIVATE/renewal
```

Use `--signer-name NAME` before `renew` when required by the existing signer configuration. Do not put secrets in command arguments, scheduler examples or public logs. The worker takes its state lock and reconciles pending submissions before trying another operation. An unresolved send stops the run; investigate its saved signature and finalized account state rather than starting a second worker. Retain this directory across binary upgrades, reboot and container replacement.

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

Use the existing container scheduler or a single supervised worker service to invoke the same one-shot command hourly. Mount the private configuration and signer environment using the deployment's secret mechanism, and mount `/PRIVATE/renewal` on persistent storage owned by the worker's user. Keep one replica; do not embed the worker in every Kora replica. Preserve state when rebuilding or replacing a container.

Where the platform lacks a periodic job facility, a single supervised service may call the private wrapper, wait 3600 seconds and repeat. Propagate termination to any active child, retain failure logs and let the service manager restart the worker after host/container restart. A timer or wait duration is only a wake-up mechanism; it must never replace the publisher's finalized-chain checks. Document the platform's exact start, status, log and stop commands in the private operating note.

## Verify, monitor and retire

After the first run, read the finalized record through the strict client, independently fetch its signed anchor, and check the remaining 48-hour lifetime. Verify the timer is enabled, the worker can still reach the live Kora endpoint and signer, its SOL covers future transaction fees, and its persistent state is accessible after restart. Monitor renewal failures and remaining chain-time validity before expiry. An unexpired record still requires a responsive endpoint, sufficient operator balance and independently verified live quotes.

Before manual publication, coordinate with the sole renewal worker. Before retirement, disable its timer/service on every configured host, wait for an active run to finish, and reconcile pending submissions. Then run `close` with a fresh journal and verify finalized closure and returned rent. A running worker may otherwise recreate the account. Preserve Kora's deny entry until it is no longer needed; it also protects future recreation at the same address.
