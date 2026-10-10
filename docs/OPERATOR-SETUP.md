# Operator host and installation reference

**Follow [AGENTS.md](../AGENTS.md) for the setup sequence and required checks.** This page supplies host, RPC and native-build details when that procedure links here. For human choices and the copyable agent brief, start with the [README](../README.md#set-up-your-operator).

## Choose a host

You choose the host and region: a Mac, Linux server or VPS, Windows with WSL, or a compatible cloud container service. The requirement is a supported Kora installation plus Node.js 24+ for the listing runner, not a particular hosting company. Check OS and CPU support for both; ARM machines such as Raspberry Pi need a compatible Kora build or image.

Choose a machine or cloud host that stays online, a public HTTPS hostname for Kora, a **Solana mainnet RPC endpoint**, and a [Jupiter API key](https://developers.jup.ag/portal). The RPC must support finalized block/account reads and `getProgramAccounts` for listing discovery. Provide persistent storage for the runner's state.

Keep a short deployment note with the host, hostname, config paths and chosen fee. Store credentials in the host's secret manager or private service environment, outside this repository.

### Free RPC options

Reuse working mainnet RPC access. If none is chosen, use the Helius dashboard route below; Quicknode x402 is an advanced integration to select only when requested or an adapter already exists.

You can start with free RPC access. These are provider allowances, not free Solana transactions: the operator still funds SOL fees, account rent and hosting. Limits below were checked on **8 October 2026**; check the linked provider documentation during setup.

| Provider | Free access | How to connect |
|---|---|---|
| **Helius** | 1 million credits/month; 10 requests/second and 1 `sendTransaction`/second | [Sign up for the free plan](https://dashboard.helius.dev/signup?plan=free), create an API key and copy the mainnet RPC URL from the dashboard. Use that private URL for both services. |
| **Quicknode x402 — advanced** | Up to 1 million credits per wallet/month through its test-token faucet route | Agent access was tested. Requires a separately implemented private RPC adapter; no adapter installer is included here. See the integration notes below. |

**Set up Helius:**

1. Reuse an existing Helius key, or complete the [free dashboard signup](https://dashboard.helius.dev/signup?plan=free), including any login/email verification.
2. Copy the full **mainnet RPC URL** into private storage. Use that same URL for Kora's `RPC_URL` and the runner's `SOLANA_RPC_URL`. The Sender endpoint only submits transactions; use the full RPC service.
3. Obtain or reuse the separate Jupiter API key, then return to AGENTS.md to continue installation.

The free dashboard plan is separate from [Helius's agent signup](https://www.helius.dev/agents), which currently requires 1 USDC and approximately 0.001 SOL. [Helius pricing](https://www.helius.dev/pricing).

<details>
<summary>Quicknode x402: agent bootstrap tested; adapter integration required</summary>

Choose this route when requested, or when a working adapter is already available. These are integration requirements, not a supplied installer. An agent must implement and verify the missing adapter before using it for an operator.

**For agent-managed Quicknode access:** follow the provider's [x402 instructions](https://x402.quicknode.com/llms.txt). Generate and privately persist a dedicated Base Sepolia wallet; sign in through `/auth`, claim `/drip`, and exchange faucet test USDC for credits. The current faucet grants 10 test USDC; 1 buys 100,000 credits. Send authenticated RPC requests to `https://x402.quicknode.com/solana-mainnet`. The funding chain is separate from the RPC network: this route was tested against real Solana mainnet.

The faucet can be claimed again each UTC calendar month, subject to its daily budget. The shared free usage cap resets at 00:00 UTC on the first; credits do not refill merely because the date changes. Automate authentication refresh, credit purchases from test tokens and monthly faucet claims. Do not switch to real-money payments without an authorized budget.

The agent must install and supervise a private adapter that adds the Bearer token and handles that lifecycle, then point `RPC_URL` and `SOLANA_RPC_URL` at it. Keep wallet secrets and tokens private, preserve RPC response bytes (including large integers), and expose the adapter only to the two services. **This repository does not currently ship that adapter.** Our isolated adapter tests passed mainnet discovery, unsigned simulations and Kora NEIRO quoting; signed settlement, unattended monthly replenishment and production reliability through this route remain unverified. Complete the checks in AGENTS.md before declaring an operator ready.

</details>

**Jupiter remains separate.** The tested stock Kora build with `price_source = "Jupiter"` requires `JUPITER_API_KEY`. Jupiter's public price API and MCP work keylessly, but they do not replace that setting in unchanged Kora. Obtain a [free Jupiter key](https://developers.jup.ag/docs/portal/setup); keep Kora and its SDK unchanged.

## Install Kora and the listing runner

Use the container installation and Node runner commands in [AGENTS.md step 1](../AGENTS.md#1-install-latest-upstream-kora-and-the-runner). The native alternative follows.

**Native installation:** when a container is unsuitable, install Rust and upstream's build prerequisites, then build the exact current-main revision into a dedicated installation directory. This is a Kora build; the Node listing runner needs no compilation:

```sh
set -eu
NPN_KORA_SHA="$(git ls-remote https://github.com/solana-foundation/kora.git refs/heads/main | cut -f1)"
test "${#NPN_KORA_SHA}" -eq 40
cargo install --git https://github.com/solana-foundation/kora.git --rev "$NPN_KORA_SHA" --locked --root "$HOME/.local/share/npn-kora" kora-cli
"$HOME/.local/share/npn-kora/bin/kora" --version
```

Use this absolute executable path in the service; an older `kora` elsewhere on `PATH` is not the selected build. Record its source SHA and binary hash. Do not change the supplied security config to accommodate an old binary.

## Private environment

Set these in the services' private environment:

| Variable | Used by | Value |
|---|---|---|
| `RPC_URL` | Kora | Your mainnet Solana RPC URL |
| `SOLANA_RPC_URL` | Listing runner | Your mainnet Solana RPC URL |
| `JUPITER_API_KEY` | Kora | Your Jupiter credential |
| Signer variables from `signers.toml` | Both | Local key or remote-provider credentials |

The local signer template expects the **key value**, not a file path, in `KORA_PRIVATE_KEY`. For supported remote signers and credential references, use [SIGNING.md](SIGNING.md). Keep secrets out of chat and Git.

## HTTPS and hosting

Use your host's HTTPS ingress or reverse proxy to forward the public hostname to Kora. Keep internal and metrics ports private. Container services need the selected image digest, private config mounts and environment; native services need the selected absolute executable path. Configure restart after failure and reboot.

From outside the host, check the public endpoint:

```sh
curl --fail-with-body https://YOUR_OPERATOR_HOST/ \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getConfig","params":{}}'
```

`getConfig` responding is a connectivity check, not proof of safe signing or successful payment. Return to [AGENTS.md step 3](../AGENTS.md#3-protect-the-listing-then-start-kora) for the required live checks, then continue through publication and payment verification.

[Configuration reference](../CONFIGURATION.md) · [Signer reference](SIGNING.md) · [Ongoing operation and recovery](RENEWAL.md)
