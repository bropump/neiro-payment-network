# Portable operator listing runner

Node.js 24 or newer. The same JavaScript runs on supported Node platforms; operators do not compile Rust, install native build tools, or need Docker to run it. Official Kora remains unchanged.

From a reviewed checkout:

```sh
cd tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
node runner.mjs --help
```

Set `SOLANA_RPC_URL` and the existing Kora signer environment privately. Supply the same `kora.toml` and `signers.toml`. Never put key material in command arguments or chat. Derive and protect the listing before signing:

```sh
node runner.mjs address --operator OPERATOR_PUBLIC_KEY
```

Add the printed account to the existing Kora `validation.disallowed_accounts` list. Restart every public Kora replica sharing the signer and test actual signing rejects that account. Keep unrelated entries; do not deny the whole SPL Record program.

```sh
node runner.mjs renew --watch --operator OPERATOR_PUBLIC_KEY --url https://OPERATOR_HOST/ --config /PRIVATE/kora.toml --signers-config /PRIVATE/signers.toml --state-dir /PRIVATE/renewal
```

This creates/migrates the listing if needed, then checks hourly. Unchanged terms before 24 chain hours cause no signing or fee. Changes publish once live config agrees. Each signature binds exact terms to the record, genesis and finalized block anchor. Readers reject at 48 chain hours. Host time only schedules checks.

`publish` is a one-shot create/update; `renew` is one check without `--watch`. `check` performs the same live/chain preflight without loading a signing backend or submitting; pending receipts can be reconciled. `close` returns record rent to its operator. `discover` performs a bounded RPC scan and verifies candidate signatures/expiry; scan failure is not proof of no operators. Cheapest/fastest selection still needs independently verified live quotes. Record format is unchanged; no client schema migration is required for switching runners.

## Safety and recovery

One worker per signer across all machines. Keep state on private persistent storage (0700 on Unix). Stop and verify zero old Rust workers before reusing their state with Node: the two implementations' locks differ. Keep pending.json, finalized.json and archived receipts. Unknown submission outcomes block another signature. Restart cannot safely be implemented by deleting state.

The Node lock is an atomic directory, `runner.lock`. Normal exit removes it. A crash or forced kill leaves it and **fails closed**. An administrator must verify the prior worker is dead everywhere, preserve/reconcile any pending transaction, then remove only the orphan lock directory. There is no wall-clock stale-lock override. Windows has no directory fsync through Node; full sudden-power-loss durability is not claimed there. Use durable Unix storage for unattended production operation.

The runner verifies backend signatures, signer identity, network, record owner/authority, signed anchors, local/live terms and deny entry. Fee cap: 10,000 lamports; new rent cap: 7,000,000 lamports. It journals and syncs the expected signature before submission. Prefunding is recovered atomically. It creates no ATAs and moves no tokens. A valid listing does not guarantee uptime or quote honesty; clients still verify quotes and transactions. Trusted finalized RPCs remain an assumption.

Official Keychain 1.4.0 adapters: memory, Turnkey, Privy, Vault and Openfort. Only memory signing is covered by live/local integration evidence; remote adapters have mapping/error tests, not credentialed provider tests. Unsupported backends/custom http_config fail closed. Remote calls have a 30-second wrapper deadline; underlying SDK requests may continue until their own timeout, but late signatures are never returned for submission. See signer.mjs and its tests.

## Test and maintain

```sh
npm test
npm audit --registry=https://registry.npmjs.org
```

Lockfile pins dependency bytes from the official npm registry. Install scripts are disabled; never run unreviewed curl-to-shell or unpinned npx commands with signer credentials. Upgrade from a reviewed source revision, rerun tests, stop the old worker, preserve state, then restart. `--watch` is intended for supervision by the host's existing service manager. See [operator scheduling and recovery](../../../docs/RENEWAL.md).

Optional Surfpool integration (`surfpool.mjs`) refuses non-loopback RPCs, generates an ephemeral local signer, and requires EVIDENCE_DIR. It tests create, no-op, accelerated daily renewal, immediate config change, expiry, prefunding, close and full rent recovery with the actual SPL Record program. It never loads production credentials.
