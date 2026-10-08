# Signing with Solana Keychain

**Kora already uses [Solana Keychain](https://solana.com/docs/tools/keychain) for signing.** It is a library inside Kora that connects its transaction-signing flow to your chosen wallet backend. Operators do not need to install or run a separate Keychain service.

## What this means for an operator

Your operator validates a transaction using Kora’s policies, then asks its configured signer to provide the fee-payer signature. Solana Keychain is the interface used for that signing step.

Choose the backend in Kora’s standard, private `signers.toml`. The included local memory signer already uses this interface; using Keychain does not by itself mean the key is held remotely. A supported remote backend changes where signing happens without changing the NEIRO reimbursement flow or requiring a NEIRO-specific signing wrapper.

## Local or remote signing

**For production, prefer a supported remote signer for stronger key isolation.** This is optional. The included memory signer works with a dedicated local keypair.

| Choice | What your agent sets up |
| --- | --- |
| Local keypair | Private key in the host's secret storage, supplied to Kora's memory signer |
| Remote signer, such as Turnkey or Privy | Your provider wallet, private credential references and the matching Kora signer configuration |

A remote signer keeps the signing key outside the Kora host. Protect and restrict its API credentials: someone with signing access may still authorize transactions. The memory backend keeps the private key in the Kora process; solana-keychain does not make it non-exportable. Kora's transaction policies remain necessary with either choice. See the upstream [security model](https://github.com/solana-foundation/solana-keychain/blob/main/docs/SECURITY_MODEL.md).

## Ask your agent

```text
Help me choose a local or remote signer for this Kora operator.
If I choose remote signing, use a backend supported by the exact Kora
build we deploy. Configure it using secret references, validate it and
check that Kora reports the expected payer. Keep the signing key and
provider credentials out of chat, Git and public requests.
```

The agent should use [Kora's signer examples](https://github.com/solana-foundation/kora/blob/main/signers.example.toml) for the deployed revision. Backend availability in solana-keychain alone does not establish support in that Kora build. Replace the example memory entry with the chosen backend; do not accidentally leave an extra signer active. Remote signing adds provider setup, network dependency and potentially fees. Do not import or move an existing wallet unless the operator requests it.

## Listing runner compatibility

The listing runner has adapters for **memory, Turnkey, Privy, Vault and Openfort**, using compatible entries from Kora's `signers.toml` and credential references. Memory has live signing evidence; the remote adapters have configuration and timeout tests but need verification with your chosen provider credentials. Para and other Kora backends are not currently supported by this runner.

Check these constraints before deployment:

- **Custom HTTP options:** the runner rejects nonempty `http_config`, even where Kora supports it. Do not silently remove required provider settings to pass validation.
- **Vault field names:** use `vault_addr_env`, `vault_token_env`, `key_name_env` and `pubkey_env`. The upstream example's older `addr_env` / `token_env` names do not match the inspected Kora parser or this runner. Validate against the deployed build.
- **Signer pools:** `--signer-name NAME` selects the runner's local entry. The runner also requires the endpoint's unparameterized `getPayerSigner` response to name that operator and payment address. A rotating pool can return another signer and block publication or renewal. Use an endpoint consistently selecting the listed signer; do not bypass this guard or assume the flag controls Kora's pool.

The [adapter source](../tools/kora-publisher/script/signer.ts) defines the accepted fields. Validate both services and test the selected backend's attestation and transaction signatures before claiming compatibility.

Select a backend that both services support before funding a new deployment. Unsupported options fail closed. Keep the same public signer in Kora and the runner; changing custody does not require changing the public key if your provider supports that migration. Never move an existing key or change custody without the operator's instruction.

## Create a new local operator wallet

Use this only when creating a new wallet, not to replace an existing signer. Install the [Solana CLI](https://solana.com/docs/intro/installation) on the private administration machine. On macOS/Linux, replace `/PRIVATE` with your private deployment directory and run:

```sh
umask 077
mkdir -p /PRIVATE
solana-keygen new --silent --no-bip39-passphrase --outfile /PRIVATE/operator.json
solana-keygen pubkey /PRIVATE/operator.json
```

The `solana-keygen new` command creates a secret keypair file without displaying its seed phrase; the final command prints only the public address. Do not add `--force`: an existing wallet file must not be overwritten. Protect and back up the keypair file so you retain recovery access. On Windows, restrict the directory and file ACLs to the service/administrator before creating the wallet; the Unix `umask` command does not apply.

Configure your host's secret storage to supply the **contents** of that JSON file as `KORA_PRIVATE_KEY` to Kora and the listing runner. Do not put the filename in that variable, display the contents in logs, or commit the file. Keep the public address in your deployment note and use it as `YOUR_OPERATOR_PUBLIC_KEY` in the setup guide. For remote signing, create the wallet with your provider and configure its supported credential references instead.
