<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO GAS Network

Run a Kora operator that pays Solana transaction fees in SOL and receives NEIRO. Clients find your signed URL and fee terms onchain and request quotes directly. No router registration is required.

## Set up your operator

**Start here with an empty host. Finish with a funded, reachable operator, a verified onchain listing and automatic renewal.** You will run two services: Kora handles payments; the listing runner publishes and renews your terms.

Follow the steps in order. If you already run Kora, reuse your signer, funding and private configuration; check the relevant steps rather than replacing them.

### 1. Choose the host and connection details

Choose a machine or cloud host that stays online, a public HTTPS hostname for Kora, a **Solana mainnet RPC endpoint**, and a [Jupiter API key](https://portal.jup.ag/). The RPC must support finalized block/account reads and `getProgramAccounts` for listing discovery. Provide persistent storage for the runner's state.

Keep a short deployment note with the host, hostname, config paths and chosen fee. Store credentials in the host's secret manager or private service environment, outside this repository.

### 2. Install Kora and the listing runner

Install [official Kora for your host](https://solana.com/docs/tools/kora/operators#deployment). For container hosting, the upstream main image is `ghcr.io/solana-foundation/kora:edge`; select a successfully published revision and pin its digest in the deployment. The current upstream edge image targets Linux amd64; check your host's architecture before choosing it. For an existing native Kora installation, use its `kora` executable. See the [upstream image workflow](https://github.com/solana-foundation/kora/blob/main/.github/workflows/docker-edge.yml).

Install [Node.js 24 or newer](https://nodejs.org/en/download) (includes npm) and [Git](https://git-scm.com/downloads) on the runner's host, then:

```sh
git clone https://github.com/bropump/neiro-payment-network-core.git
cd neiro-payment-network-core/tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
node runner.ts --help
```

Keep this directory as the runner's working directory. The following `node runner.ts` commands run here; `kora` commands run on the Kora host or inside its container with the same arguments. Replace `/PRIVATE/...`, `YOUR_OPERATOR_PUBLIC_KEY` and `https://YOUR_OPERATOR_HOST/` throughout with your actual paths and public details. Use absolute paths accessible to each service.

**Check:** record the installed Kora revision; `node --version` reports 24 or newer and the runner prints its commands.

### 3. Set up the signing wallet and private config

Create or select a **dedicated operator wallet** using your chosen [Kora signer backend](docs/SIGNING.md). For a new local wallet, follow the [wallet creation commands](docs/SIGNING.md#create-a-new-local-operator-wallet); for remote signing, provision a Solana Ed25519 wallet with the selected provider. Keep its recovery access and record its public address as `YOUR_OPERATOR_PUBLIC_KEY`. The listing runner must support that backend too; its currently supported adapters are listed in the signing guide.

For a new operator, copy these files into your private deployment directory:

- [kora.toml](examples/operator/kora.toml) — accepted tokens, fees and spending permissions.
- [signers.toml](examples/operator/signers.toml) — which wallet signs and how it is accessed.

The supplied signer template uses `KORA_PRIVATE_KEY`: put the dedicated wallet's key material in that private environment variable through your secret manager. It expects the key value, **not a file path**. For a remote signer, replace that entry with the provider configuration and credential references. Give Kora and the runner access to the same selected signer. Never paste keys into chat or commit them to Git.

In `kora.toml`, choose your fee under `[validation.price]`: **margin**, **fixed NEIRO** or **free**. The template's **50% margin is an example**. Also choose `max_allowed_lamports`, the per-transaction spending allowance; it is not a daily budget. Keep the NEIRO mint and required API methods enabled. See [fee examples](TUTORIAL.md#3-set-your-fees) and [spending permissions](CONFIGURATION.md).

Set these in the services' private environment:

| Variable | Used by | Value |
|---|---|---|
| `RPC_URL` | Kora | Your mainnet Solana RPC URL |
| `SOLANA_RPC_URL` | Listing runner | Your mainnet Solana RPC URL |
| `JUPITER_API_KEY` | Kora | Your Jupiter credential |
| Signer variables from `signers.toml` | Both | Local key or remote-provider credentials |

**Check:** both services select the intended public key. If the signer file contains multiple entries, select the runner's entry with `--signer-name NAME`; the Kora endpoint must select that same payer.

### 4. Fund the operator and prepare NEIRO receipts

Send SOL to the operator's public wallet for listing rent, network fees and the payments you intend to sponsor. Choose the amount for your workload; there is no fixed network deposit. Keep a separate customer wallet with a small amount of NEIRO for the end-to-end test in step 9.

Validate the configuration, then use Kora to create any missing fee-receiving token account:

```sh
kora --config /PRIVATE/kora.toml config validate
kora --config /PRIVATE/kora.toml rpc initialize-atas --signers-config /PRIVATE/signers.toml --fee-payer-key YOUR_OPERATOR_PUBLIC_KEY
```

The second command is an onchain operation: it may spend SOL on account rent and transaction fees. It prepares token accounts for the configured payment tokens and can cover all configured pool signers. The explicit fee-payer key chooses who pays. For an existing multi-signer pool, inspect the account-creation scope first; do not fund unrelated accounts by accident. Reuse existing accounts. The operator can receive NEIRO without first depositing NEIRO. Keep the fee-receiving account open while operating. [Upstream command reference](https://solana.com/docs/tools/kora/operators/cli#managing-atas).

**Check:** mainnet shows the expected operator SOL balance and NEIRO fee-receiving account. NEIRO reimbursement does not automatically refill SOL.

### 5. Protect the listing before serving public requests

```sh
node runner.ts protect --operator YOUR_OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml
```

This prints the derived listing address, adds it to **`[validation].disallowed_accounts`** in your config and saves a backup. It preserves existing entries and other settings. It does not sign, submit or restart anything.

Apply that updated file to **every Kora instance sharing this key**. Block the listing address, not the operator wallet or the whole SPL Record program. If Kora was already running, restart all those instances before continuing.

**Check:** each deployed config contains the printed listing address. Editing a local copy does not update a remote deployment.

### 6. Start Kora and connect HTTPS

With the private environment and updated config loaded, start Kora:

```sh
kora --config /PRIVATE/kora.toml rpc start --signers-config /PRIVATE/signers.toml --port 8080
```

Configure your host's HTTPS ingress or reverse proxy to forward your chosen hostname to this service. Keep internal and metrics ports private. For a native installation, use the host's service manager; for container hosting, configure the equivalent command, config mounts and secrets in the platform. Set Kora to restart after failure and host reboot.

From outside the host, check the public endpoint:

```sh
curl --fail-with-body https://YOUR_OPERATOR_HOST/ \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getConfig","params":{}}'
```

Check `getPayerSigner` in the same way by changing `method`. The signer, payment destination, NEIRO acceptance, fees and blocked listing must match your setup. The runner also checks these before publication. Its endpoint calls currently do not supply API-key/HMAC/CAPTCHA credentials; resolve unsupported access requirements without exposing keys or silently removing existing protections.

**Check:** an enabled public signing method rejects a bounded request touching your listing because of the account-deny rule. An authentication error or disabled-method response does not prove this. Have the setup agent perform this non-destructive check on each public instance before publishing; see the [verification checklist](docs/AGENT-SETUP.md).

### 7. Publish and renew the listing

Run this command with the selected signer's private environment and `SOLANA_RPC_URL` loaded:

```sh
node runner.ts renew --watch \
  --operator YOUR_OPERATOR_PUBLIC_KEY \
  --url https://YOUR_OPERATOR_HOST/ \
  --config /PRIVATE/kora.toml \
  --signers-config /PRIVATE/signers.toml \
  --state-dir /PRIVATE/renewal
```

That command creates the listing on its first run, then checks hourly. It renews unchanged terms after 24 chain hours and publishes changed terms once running Kora matches. Clients reject listings at 48 chain hours; the host clock does not set their expiry.

**Check:** `"status":"finalized"` includes the publication signature. `"status":"unchanged"` means an existing signed listing is already current. Save the listing address and finalized transaction receipt. Errors are not successful registration.

### 8. Install automatic startup and check discovery

Install the exact step 7 command as **one supervised service per operator signer**, with the same private environment and persistent state directory. Use your host's service manager: systemd on Linux, launchd on macOS, or the container platform's service controls. On Bunny, run one private worker with a persistent volume, not one in every Kora region. A terminal left open is not an installed service.

Stop the foreground runner cleanly before starting its managed service. Preserve `/PRIVATE/renewal` across restarts and updates. Then restart both services through their managers and verify Kora responds and the runner resumes successfully. Record the exact start, stop, status and log commands for your host. See [operation and recovery](docs/RENEWAL.md).

Configure your host's monitoring to alert on either service failing, SOL falling below your chosen operating reserve, and listing age approaching the 48-hour deadline. Use finalized RPC chain time for listing age; choose an alert threshold with time to fix a failed renewal. Trigger a test alert and confirm it reaches you.

From the runner directory, with `SOLANA_RPC_URL` loaded:

```sh
node runner.ts discover
```

**Check:** your listing appears with the correct operator, URL and fee terms, a valid signature and an unexpired chain anchor. If discovery fails, check the RPC's scan support; do not report success from publication alone.

### 9. Prove a payment works, then finish

Use a separate customer wallet and the [direct-client payment flow](docs/BUILD-WITH-NEIRO.md#start-with-a-payment). Discover the operator onchain, request a quote, verify the fee against its signed terms, and inspect the exact transaction. Send one small payment within the agreed amount, recipient and fee limits.

Paid NEIRO quotes require a sufficiently fresh oracle price. If Kora reports stale data, keep the configured freshness limit and report the paid-payment check blocked; do not silently disable the check or change the operator's fee mode. Free sponsorship is a separately chosen mode with no reimbursement.

**Check:** the transaction finalized successfully, the recipient received the intended amount, and the operator's SOL cost and NEIRO reimbursement match the approved transaction. Save its signature and balance changes. Return test funds and close only eligible temporary test accounts; keep the operator's fee-receiving account and operational listing.

**Setup is finished when all of these are true:**

- Kora is reachable over HTTPS and its listing protection is enforced.
- Clients can discover and verify the signed listing through RPC.
- A direct sponsored payment finalized with the expected fees and balances.
- Kora and the single renewal worker restart correctly with their saved state.
- Monitoring alerts you about service failures, low SOL and failed renewal before the 48-hour deadline. Your operating note contains the signer, listing, URL, receipts and exact service commands.

Until the payment or protection check passes, describe the setup as incomplete. The first real daily renewal is a follow-up operating check; record its finalized receipt when due. SOL funding and endpoint availability need ongoing monitoring.

## Let an agent do the setup

Give it this repository and say:

> Set up a NEIRO operator from zero on my chosen host. Follow all nine README steps through to the finish checks, including Kora installation, signer and funding, protected config, HTTPS, publication, supervised renewal, direct discovery and an authorized test payment. Reuse anything I already have. Ask only for missing choices or access, keep credentials private, and leave exact operating commands and receipts. Report any unfinished check explicitly.

[Agent verification checklist](docs/AGENT-SETUP.md) · [Operations](docs/RENEWAL.md) · [Client integration](docs/BUILD-WITH-NEIRO.md) · [Record format](docs/SPL-RECORD-LISTINGS.md#operator-attestation-v5) · [Security review](tools/kora-publisher/SECURITY-REVIEW.md)
