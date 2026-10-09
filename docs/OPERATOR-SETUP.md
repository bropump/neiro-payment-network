# Set up your NPN operator

**[Agent operator procedure](../AGENTS.md)** · **[Client / builder guide](BUILD-WITH-NEIRO.md)**

**Start here with an empty host. Finish with a funded, reachable operator, a verified onchain listing and automatic renewal.** The two core services are Kora, which handles payments, and the listing runner, which publishes and renews your terms. The optional Quicknode x402 route also needs a private RPC adapter.

Follow the steps in order. If you already run Kora, reuse your signer, funding and private configuration; check the relevant steps rather than replacing them.

**Standard setup:** reuse a working mainnet RPC, or choose Helius's free dashboard plan if none has been chosen. Use a Jupiter API key and official Kora. Quicknode x402 is an advanced integration with additional work; do not select it automatically just because it avoids signup.

Before starting, record these inputs in the private deployment note. Reuse known answers and ask only for what is missing:

| Input | What the agent needs |
|---|---|
| Host and HTTPS | Access to the chosen machine/container host and its public hostname or managed ingress |
| RPC and pricing | Mainnet RPC URL and Jupiter API key, supplied through private storage |
| Signer | Existing operator identity and custody, or the selected backend for a new dedicated wallet |
| Fee and funding | User-selected fee, SOL operating budget and transaction limits |
| Payment test | Customer wallet access and authorized recipient, amount and maximum fee |

An agent can install and configure the services; account login/verification, unavailable hosting access and wallet funding may still require the operator. Never ask for secret values in chat.

## 1. Install the software and select your wallet

### Choose a host

You choose the host and region: a Mac, Linux server or VPS, Windows with WSL, or a compatible cloud container service. The requirement is a supported Kora installation plus Node.js 24+ for the listing runner, not a particular hosting company. Check OS and CPU support for both; ARM machines such as Raspberry Pi need a compatible Kora build or image.

Choose a machine or cloud host that stays online, a public HTTPS hostname for Kora, a **Solana mainnet RPC endpoint**, and a [Jupiter API key](https://developers.jup.ag/portal). The RPC must support finalized block/account reads and `getProgramAccounts` for listing discovery. Provide persistent storage for the runner's state.

Keep a short deployment note with the host, hostname, config paths and chosen fee. Store credentials in the host's secret manager or private service environment, outside this repository.

#### Free RPC options

You can start with free RPC access. These are provider allowances, not free Solana transactions: the operator still funds SOL fees, account rent and hosting. Limits below were checked on **8 October 2026**; check the linked provider documentation during setup.

| Provider | Free access | How to connect |
|---|---|---|
| **Helius** | 1 million credits/month; 10 requests/second and 1 `sendTransaction`/second | [Sign up for the free plan](https://dashboard.helius.dev/signup?plan=free), create an API key and copy the mainnet RPC URL from the dashboard. Use that private URL for both services. |
| **Quicknode x402 — advanced** | Up to 1 million credits per wallet/month through its test-token faucet route | Agent access was tested. Requires a separately implemented private RPC adapter; no adapter installer is included here. See the integration notes below. |

**Set up Helius:**

1. Reuse an existing Helius key, or complete the [free dashboard signup](https://dashboard.helius.dev/signup?plan=free), including any login/email verification.
2. Copy the full **mainnet RPC URL** into private storage. Use that same URL for Kora's `RPC_URL` and the runner's `SOLANA_RPC_URL` in step 1. The Sender endpoint only submits transactions; use the full RPC service.
3. Obtain or reuse the separate Jupiter API key, then continue to the installation instructions below.

The free dashboard plan is separate from [Helius's agent signup](https://www.helius.dev/agents), which currently requires 1 USDC and approximately 0.001 SOL. [Helius pricing](https://www.helius.dev/pricing).

<details>
<summary>Quicknode x402: agent bootstrap tested; adapter integration required</summary>

Choose this route when requested, or when a working adapter is already available. These are integration requirements, not a supplied installer. An agent must implement and verify the missing adapter before using it for an operator.

**For agent-managed Quicknode access:** follow the provider's [x402 instructions](https://x402.quicknode.com/llms.txt). Generate and privately persist a dedicated Base Sepolia wallet; sign in through `/auth`, claim `/drip`, and exchange faucet test USDC for credits. The current faucet grants 10 test USDC; 1 buys 100,000 credits. Send authenticated RPC requests to `https://x402.quicknode.com/solana-mainnet`. The funding chain is separate from the RPC network: this route was tested against real Solana mainnet.

The faucet can be claimed again each UTC calendar month, subject to its daily budget. The shared free usage cap resets at 00:00 UTC on the first; credits do not refill merely because the date changes. Automate authentication refresh, credit purchases from test tokens and monthly faucet claims. Do not switch to real-money payments without an authorized budget.

The agent must install and supervise a private adapter that adds the Bearer token and handles that lifecycle, then point `RPC_URL` and `SOLANA_RPC_URL` at it. Keep wallet secrets and tokens private, preserve RPC response bytes (including large integers), and expose the adapter only to the two services. **This repository does not currently ship that adapter.** Our isolated adapter tests passed mainnet discovery, unsigned simulations and Kora NEIRO quoting; signed settlement, unattended monthly replenishment and production reliability through this route remain unverified. Complete the installation checks below before declaring an operator ready.

</details>

**Jupiter remains separate.** The tested stock Kora build with `price_source = "Jupiter"` requires `JUPITER_API_KEY`. Jupiter's public price API and MCP work keylessly, but they do not replace that setting in unchanged Kora. Obtain a [free Jupiter key](https://developers.jup.ag/docs/portal/setup); keep Kora and its SDK unchanged.

### Install Kora and the listing runner

**Kora version: always official upstream `main`, including merged fixes.** Do not install a crates.io release such as `cargo install kora-cli --version 2.0.5`, use a release tag, or copy an old image digest from a test report. The commit SHA identifies the code; the CLI version alone does not.

**Container installation (no local Rust compilation):** use a running Docker-compatible engine and confirm its context is the intended host. The [official edge workflow](https://github.com/solana-foundation/kora/blob/main/.github/workflows/docker-edge.yml) currently publishes Linux amd64; ARM hosts need working amd64 emulation or a native source build. Run this block in `sh`/`bash` on that host:

```sh
set -eu
NPN_KORA_SHA="$(git ls-remote https://github.com/solana-foundation/kora.git refs/heads/main | cut -f1)"
test "${#NPN_KORA_SHA}" -eq 40
docker pull --platform linux/amd64 ghcr.io/solana-foundation/kora:edge
NPN_KORA_REVISION="$(docker image inspect ghcr.io/solana-foundation/kora:edge --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
if [ "$NPN_KORA_REVISION" != "$NPN_KORA_SHA" ]; then
  echo 'Edge does not match current main. Wait for its build and repeat; do not use an older release.' >&2
  exit 1
fi
NPN_KORA_IMAGE="$(docker image inspect ghcr.io/solana-foundation/kora:edge --format '{{index .RepoDigests 0}}')"
printf 'Kora main: %s\nDeploy image: %s\n' "$NPN_KORA_SHA" "$NPN_KORA_IMAGE"
docker run --rm --platform linux/amd64 "$NPN_KORA_IMAGE" kora --version
```

Save that SHA and digest in the deployment note and use the digest for the service. The image command is **`IMAGE kora ...`**, not `IMAGE --config ...`: upstream defines `CMD ["kora"]`, not an entrypoint. Later `kora` commands in this guide run inside that same image with the private config mounts and environment provided by your host.

**Native installation:** when a container is unsuitable, install Rust and upstream's build prerequisites, then build the exact current-main revision into a dedicated installation directory. This is a Kora build; the Node listing runner needs no compilation:

```sh
set -eu
NPN_KORA_SHA="$(git ls-remote https://github.com/solana-foundation/kora.git refs/heads/main | cut -f1)"
test "${#NPN_KORA_SHA}" -eq 40
cargo install --git https://github.com/solana-foundation/kora.git --rev "$NPN_KORA_SHA" --locked --root "$HOME/.local/share/npn-kora" kora-cli
"$HOME/.local/share/npn-kora/bin/kora" --version
```

Use this absolute executable path in the service; an older `kora` elsewhere on `PATH` is not the selected build. Record its source SHA and binary hash. Do not change the supplied security config to accommodate an old binary.

Install [Node.js 24 or newer](https://nodejs.org/en/download) (includes npm) and [Git](https://git-scm.com/downloads) on the runner's host, then:

```sh
git clone https://github.com/bropump/neiro-payment-network.git
cd neiro-payment-network/tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
node runner.ts --help
```

Keep this directory as the runner's working directory. The following `node runner.ts` commands run here; `kora` commands run on the Kora host or inside its container with the same arguments. Replace `/PRIVATE/...`, `YOUR_OPERATOR_PUBLIC_KEY` and `https://YOUR_OPERATOR_HOST/` throughout with your actual paths and public details. Use absolute paths accessible to each service.

Repeat main resolution at deployment time if setup took long enough for upstream to change. An unavailable or failing latest build is an update blocker, not permission to silently substitute a stable release.

**Check:** record the source SHA, image digest (or native binary hash), and CLI version of the deployment actually running. `node --version` reports 24 or newer and the runner prints its commands. Install the host-managed update check described in step 4 so the service continues to track main. The listing runner does not update Kora.

### Select the signer and your fee

Create or select a **dedicated operator wallet** using your chosen [Kora signer backend](SIGNING.md). For a new local wallet, follow the [wallet creation commands](SIGNING.md#create-a-new-local-operator-wallet); for remote signing, provision a Solana Ed25519 wallet with the selected provider. Keep its recovery access and record its public address as `YOUR_OPERATOR_PUBLIC_KEY`. The listing runner must support that backend too; its currently supported adapters are listed in the signing guide.

For a new operator, copy these files into your private deployment directory:

- [kora.toml](../examples/operator/kora.toml) — accepted tokens, fees and spending permissions.
- [signers.toml](../examples/operator/signers.toml) — which wallet signs and how it is accessed.

The supplied signer template uses `KORA_PRIVATE_KEY`: put the dedicated wallet's key material in that private environment variable through your secret manager. It expects the key value, **not a file path**. For a remote signer, replace that entry with the provider configuration and credential references. Give Kora and the runner access to the same selected signer. Never paste keys into chat or commit them to Git.

In `kora.toml`, choose your fee under `[validation.price]`: **margin**, **fixed NEIRO** or **free**. The template's **50% margin is an example, not a network-set fee**. For margin pricing, `margin = 0.05` means 5% markup, `0.50` means 50%, and `1.0` means 100% on Kora's calculated reimbursable cost. This is the operator's charge, not a guaranteed profit. Choose it explicitly before publishing. Also choose `max_allowed_lamports`: Kora checks modeled sponsor SOL outflow (including account rent) and network fees separately against this limit. It is not a combined cap or daily budget. The template also caps priority fees at `100000` lamports (0.0001 SOL) per transaction using `max_priority_fee_lamports`; callers may request less, but higher amounts are rejected before signing. Keep the NEIRO mint and required API methods enabled. See [fee examples](../TUTORIAL.md#3-set-your-fees) and [spending permissions](../CONFIGURATION.md).

**Failed transactions still cost the operator SOL.** If a submitted transaction executes and fails, its network fee remains charged while the NEIRO reimbursement and rent transfers roll back. Caps bound accepted costs; they do not guarantee reimbursement or profit. Size the outflow allowance for your workload, including launch rent.

Set these in the services' private environment:

| Variable | Used by | Value |
|---|---|---|
| `RPC_URL` | Kora | Your mainnet Solana RPC URL |
| `SOLANA_RPC_URL` | Listing runner | Your mainnet Solana RPC URL |
| `JUPITER_API_KEY` | Kora | Your Jupiter credential |
| Signer variables from `signers.toml` | Both | Local key or remote-provider credentials |

**Check:** both services select the intended public key. `--signer-name NAME` selects only the runner's local entry. A rotating Kora pool can return another payer and block publication or renewal; check the [pool and backend limitations](SIGNING.md#listing-runner-compatibility).

## 2. Fund the operator and prepare NEIRO receipts

Send SOL to the operator's public wallet for listing rent, network fees and the payments you intend to sponsor. Choose the amount for your workload; there is no fixed network deposit. Keep a separate customer wallet with a small amount of NEIRO for the end-to-end test in step 5.

Validate the configuration, then use Kora to create any missing fee-receiving token account:

```sh
kora --config /PRIVATE/kora.toml config validate --signers-config /PRIVATE/signers.toml
kora --config /PRIVATE/kora.toml rpc initialize-atas --signers-config /PRIVATE/signers.toml --fee-payer-key YOUR_OPERATOR_PUBLIC_KEY
```

The second command is an onchain operation: it may spend SOL on account rent and transaction fees. It prepares token accounts for the configured payment tokens and can cover all configured pool signers. The explicit fee-payer key chooses who pays. For an existing multi-signer pool, inspect the account-creation scope first; do not fund unrelated accounts by accident. Reuse existing accounts. The operator can receive NEIRO without first depositing NEIRO. Keep the fee-receiving account open while operating. [Upstream command reference](https://solana.com/docs/tools/kora/operators/cli#managing-atas).

**Check:** mainnet shows the expected operator SOL balance and NEIRO fee-receiving account. NEIRO reimbursement does not automatically refill SOL.

## 3. Protect the listing and start Kora

### Protect the listing

```sh
node runner.ts protect --operator YOUR_OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml
```

This prints the derived listing address, adds it to **`[validation].disallowed_accounts`** in your config and saves a backup. It preserves existing entries and other settings. It does not sign, submit or restart anything.

Apply that updated file to **every Kora instance sharing this key**. Block the listing address, not the operator wallet or the whole SPL Record program. If Kora was already running, restart all those instances before continuing.

**Check:** each deployed config contains the printed listing address. Editing a local copy does not update a remote deployment.

### Start Kora and connect HTTPS

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

Check `getPayerSigner` in the same way by changing `method`. The signer, payment destination, NEIRO acceptance, fees and blocked listing must match your setup. Confirm `max_allowed_lamports` and `max_priority_fee_lamports` match your chosen limits. The estimate endpoint can quote above a cap; the signing path must reject it. The runner checks listing identity, terms and protection before publication. Its endpoint calls currently do not supply API-key/HMAC/CAPTCHA credentials; resolve unsupported access requirements without exposing keys or silently removing existing protections.

**Check:** an enabled public signing method rejects a bounded request touching your listing because of the account-deny rule. An authentication error or disabled-method response does not prove this. Have the setup agent perform this non-destructive check on each public instance before publishing; see the [verification checklist](../AGENTS.md#3-protect-the-listing-then-start-kora).

## 4. Publish your listing and keep it running

### Publish and renew

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

### Install automatic startup and check discovery

Install the exact `renew --watch` command above as **one supervised service per operator signer**, with the same private environment and persistent state directory. Use your host's service manager: systemd on Linux, launchd on macOS, or the container platform's service controls. On Bunny, run one private worker with a persistent volume, not one in every Kora region. A terminal left open is not an installed service.

Stop the foreground runner cleanly before starting its managed service. Preserve `/PRIVATE/renewal` across restarts and updates. Then restart both services through their managers and verify Kora responds and the runner resumes successfully. Record the exact start, stop, status and log commands for your host. See [operation and recovery](RENEWAL.md).

**Keep Kora on upstream main:** configure the host's updater to check upstream every five minutes, resolve the new SHA and matching published image (or native build), and deploy that revision after config validation. Pin each running deployment by digest, not permanently to an old revision. Preserve signer/config/renewal state; verify the running image or executable, listing protection and an authorized payment after rollout. Keep the previous build for rollback and alert when a build or rollout fails. A rollback is degraded/out-of-date status, not “latest.” Record the updater's schedule, last check, deployed SHA and rollout result. This repository does not install that host-specific updater automatically; without it, ongoing main tracking is incomplete.

Configure your host's monitoring to alert on either service failing, SOL falling below your chosen operating reserve, and listing age approaching the 48-hour deadline. Use finalized RPC chain time for listing age; choose an alert threshold with time to fix a failed renewal. Trigger a test alert and confirm it reaches you.

From the runner directory, with `SOLANA_RPC_URL` loaded:

```sh
node runner.ts discover
```

**Check:** your listing appears with the correct operator, URL and fee terms, a valid signature and an unexpired chain anchor. If discovery fails, check the RPC's scan support; do not report success from publication alone.

## 5. Verify a payment and finish

Use a separate customer wallet and the [direct-client payment flow](BUILD-WITH-NEIRO.md#start-with-a-payment). Discover the operator onchain, request a quote, verify the fee against its signed terms, and inspect the exact transaction. Send one small payment within the agreed amount, recipient and fee limits.

The supplied config uses `max_price_staleness_slots = 0`: Jupiter prices are accepted without an age cutoff. This avoids blocking NEIRO quotes solely because its reference price has not recently updated, but accepts stale-price risk. Confirm the live value through `getConfig`; see [pricing policy](../CONFIGURATION.md#pricing-service) before choosing a stricter limit. Verify the paid quote against the signed terms and current pricing inputs. A free-sponsored payment does not prove paid pricing works. For an explicitly free deployment, verify zero reimbursement and report free-only evidence; do not change its pricing to force a paid test.

**Check:** the transaction finalized successfully, the recipient received the intended amount, and the operator's SOL cost and NEIRO reimbursement match the approved transaction. Save its signature and balance changes. Return test funds and close only eligible temporary test accounts; keep the operator's fee-receiving account and operational listing.

**Setup is finished when all of these are true:**

- Kora is reachable over HTTPS and its listing protection is enforced.
- Clients can discover and verify the signed listing through RPC.
- A direct sponsored payment finalized with the expected fees and balances.
- Kora and the single renewal worker restart correctly with their saved state.
- The host updater checks upstream main every five minutes, and the running Kora revision and update status are recorded.
- Monitoring alerts you about service failures, low SOL and failed renewal before the 48-hour deadline. Your operating note contains the signer, listing, URL, receipts and exact service commands.

Until the payment or protection check passes, describe the setup as incomplete. The first real daily renewal is a follow-up operating check; record its finalized receipt when due. SOL funding and endpoint availability need ongoing monitoring.

## Let an agent do the setup

Give it this repository and say:

> Set up a NEIRO operator on my chosen host using all five operator setup steps and the agent verification checklist. Reuse my existing host access, signer, RPC, Jupiter key and fee choices. If no RPC is chosen, use the standard Helius path; treat Quicknode x402 as a separate integration only when requested. Complete installation, protected config, HTTPS, publication, supervised renewal, discovery and the authorized payment test. Ask only for missing inputs, keep credentials private, and leave exact operating commands and receipts. Mark every finish check PASS, FAIL or NOT RUN with evidence. Do not report the setup complete while a required check is unfinished.

[Agent verification checklist](../AGENTS.md) · [Operations](RENEWAL.md) · [Client integration](BUILD-WITH-NEIRO.md) · [Record format](SPL-RECORD-LISTINGS.md#operator-attestation-v5) · [Security review](../tools/kora-publisher/SECURITY-REVIEW.md)
