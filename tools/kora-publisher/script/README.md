# Node.js operator listing script

Publish your Kora operator's URL and signed fee terms onchain, then keep the listing renewed automatically.

**[Install and register your operator](../../../README.md#set-up-your-operator).** The guide covers prerequisites, protecting your listing in `kora.toml`, restarting Kora and starting the runner.

## Commands

Run `node runner.ts COMMAND` with the relevant options:

| Command | What it does |
|---|---|
| `protect --operator PUBLIC_KEY --config /PRIVATE/kora.toml` | Adds the derived listing to the existing deny list, with a backup. Does not restart Kora or sign. |
| `address --operator PUBLIC_KEY` | Prints the derived listing address without changing anything. |
| `renew --watch` | Creates/updates the listing and checks hourly for renewal. Recommended service command. |
| `check` | Checks live config and chain state without loading a signer or submitting. |
| `publish` or `renew` without `--watch` | Performs one create/update/renewal check. |
| `discover` | Scans and verifies onchain listings through your RPC. Does not select quotes. |
| `close` | Closes the listing and returns its rent to the operator. Stop the worker first. |

`renew`, `publish` and `check` take the operator, URL, config, signer-config and state-directory options shown in the main guide. `close` needs operator, signer config and the same state directory; it can work while Kora is offline. `--signer-name` selects one entry when your signer file contains several. Use `SOLANA_RPC_URL` for chain RPC and the existing private Kora signer environment for credentials.

## Essential operating rules

- Restart every Kora instance after `protect`. The runner checks the deny entry in the file and responding service before publishing; it cannot restart or inspect every deployment for you.
- Keep one worker per signer and preserve its private state directory. Unknown transaction outcomes block another signature; do not delete state to bypass them.
- `--watch` needs a service manager to survive reboot. See [operations and recovery](../../../docs/RENEWAL.md).

The runner signs through Solana Keychain, limits transaction fees and account rent, and saves each transaction before sending it so interrupted submissions can be recovered. See the [security review and tested limits](../SECURITY-REVIEW.md).

## Development checks

```sh
npm run typecheck
npm test
npm audit --registry=https://registry.npmjs.org
```

`surfpool.mjs` is the optional local-chain integration test. It uses an ephemeral signer, rejects non-loopback RPCs, and requires `EVIDENCE_DIR`. It tests creation, renewal, expiry and rent recovery without loading production keys.
