<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO GAS Network

Run a Kora operator that pays Solana transaction fees in SOL and accepts NEIRO. Publish your URL and fee terms onchain so clients can discover your operator and verify quotes directly. No router registration is required.

The listing runner registers your Kora operator onchain and renews its signed URL and fee terms daily.

## Set up your operator

Install **[Node.js 24 or newer](https://nodejs.org/en/download)** (includes npm) and **[Git](https://git-scm.com/downloads)**. You also need a running Kora operator, your operator's `kora.toml` and `signers.toml`, its signing credentials, SOL funding, Solana RPC, Jupiter credentials and a public HTTPS endpoint. Keep credentials in your existing private service environment.

Starting from scratch? Install [official Kora](https://solana.com/docs/tools/kora/operators#deployment), copy our [NEIRO config](examples/operator/kora.toml) and [signer template](examples/operator/signers.toml) into your private deployment directory, and choose your fees before starting it publicly. The example margin is **50%**; change it to your intended fee. For an existing operator, keep your current files and settings.

### 1. Install the listing script

```sh
git clone https://github.com/bropump/neiro-payment-network-core.git
cd neiro-payment-network-core/tools/kora-publisher/script
npm ci --ignore-scripts --registry=https://registry.npmjs.org
```

Run the commands below from this directory. Replace `YOUR_OPERATOR_PUBLIC_KEY`, `https://YOUR_OPERATOR_HOST/` and the `/PRIVATE/...` paths with your actual values. Use absolute paths. The public key is your Kora signing wallet.

### 2. Add the listing's blocked address automatically

```sh
node runner.ts protect --operator YOUR_OPERATOR_PUBLIC_KEY --config /PRIVATE/kora.toml
```

This derives your listing address, adds it to **`[validation].disallowed_accounts`** in your existing `kora.toml`, and saves a backup. It preserves existing blocked addresses, fees and other settings. It loads no key and sends no transaction. Running it again makes no change if the address is already there.

### 3. Restart Kora with that config

Restart your existing Kora service/container using the updated file. **Every Kora instance using this operator key must load the blocked address.** If this is a new operator, start Kora with that file now.

`protect` edits the file; it does not restart Kora. The listing runner refuses to publish if its config file or the responding Kora endpoint is missing the blocked address.

### 4. Start publication and automatic renewal

Use the same private signer environment as Kora. Set `SOLANA_RPC_URL` to your Solana RPC endpoint, then run:

```sh
node runner.ts renew --watch \
  --operator YOUR_OPERATOR_PUBLIC_KEY \
  --url https://YOUR_OPERATOR_HOST/ \
  --config /PRIVATE/kora.toml \
  --signers-config /PRIVATE/signers.toml \
  --state-dir /PRIVATE/renewal
```

**That one command creates the listing and keeps it renewed.** No separate registration or daily signing command is needed. The state directory is created if missing; keep it on persistent storage. With multiple signers in your file, add `--signer-name NAME`.

A successful publication prints `"status":"finalized"` and its transaction signature. `"status":"unchanged"` means the existing signed listing is already current. The script checks hourly, renews unchanged terms after 24 chain hours, and publishes changed terms once the running Kora config matches. Clients reject listings older than 48 chain hours. Your computer's clock does not determine that expiry.

### 5. Keep it running

Run that same command as **one supervised service**, using your host's normal service manager so it starts again after reboot. A terminal session alone is not an installed service. On Bunny, use one private worker with persistent storage, not one worker in every Kora region.

Keep one worker per signer, preserve its state directory, and stop it before closing the listing. See [operating, updating and recovery](docs/RENEWAL.md).

## Let an agent do the setup

Give it this repository and say:

> Follow this README and AGENTS.md to set up my operator on my chosen host. Reuse my existing config and signer. Install the Node runner, run `protect`, restart every Kora instance sharing the key, verify the blocked account is enforced, and run `renew --watch` as one persistent service. Verify publication and direct discovery, then leave my exact start, stop and update commands. Keep credentials private.

[Agent verification checklist](docs/AGENT-SETUP.md)

## What the listing proves

The operator signs its URL, payment address, mint and fee terms, bound to its own record and Solana network. Clients discover listings through Solana RPC, read live SOL balances and request quotes directly. They still verify the quoted fee and transaction; a listing does not guarantee uptime or honest quotes. Optional routers can do selection, but are not required.

[Client integration](docs/BUILD-WITH-NEIRO.md) · [Onchain format](docs/SPL-RECORD-LISTINGS.md#operator-attestation-v5) · [Fees and spending policies](CONFIGURATION.md) · [Signing backends](docs/SIGNING.md) · [Security review](tools/kora-publisher/SECURITY-REVIEW.md)
