<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO GAS Network

## Solana transactions. Gas paid in NEIRO.

The NEIRO GAS Network is an open network of payment sponsor operators running [Kora](https://github.com/solana-foundation/kora). Operators pay transaction fees in SOL and receive payment in NEIRO. You choose your fees, host and wallet; the router selects eligible operators by regional response time or estimated fee.

Integrated clients and apps can let users pay transaction fees in NEIRO without maintaining a separate SOL balance for sponsored transactions. Transactions still run and settle on Solana.

Our testing has included x402, MPP, Jupiter swaps, transfers and trades.

Run Kora, accept NEIRO for transaction fees, and publish an onchain listing for direct discovery or connect to the existing NEIRO router. This repository provides configuration, setup guidance and the small listing publisher. Kora itself remains the official upstream software.

**Start with the [official Kora deployment guide](https://solana.com/docs/tools/kora/operators#deployment).** Follow it to install and run Kora on your chosen host, use our [NEIRO configuration](examples/operator/kora.toml) and [signer template](examples/operator/signers.toml), then follow the [agent setup](docs/AGENT-SETUP.md) to publish and verify your operator. [Router registration](#connect-your-operator-in-3-steps) remains available for the routed service.

## Optional onchain operator listing

Operators can publish their declared fee terms in SPL Record for clients to discover directly through Solana RPC. The [standalone Rust publisher and listing-protection setup](docs/SPL-RECORD-LISTINGS.md) keeps official Kora unchanged. Each operator must deny their own listing account before publishing. This optional flow does not require the router; the registration instructions below describe the existing routed service.

## Ask your agent to set it up

Give your coding agent this repository and paste:

```text
Set up a NEIRO Kora operator on my chosen host using this repository.
Follow AGENTS.md and docs/AGENT-SETUP.md through to verified operation.
Build unchanged Kora and the Rust listing publisher, configure my signer,
check SOL and NEIRO accounts, derive and deny my listing address in
kora.toml before starting Kora, then sign and publish my SPL Record terms.
Verify direct discovery, the loaded deny rule and independent quote checks.
Use my existing permissions and payment limits for any live test, recover
test funds as requested, and report receipts and costs. Keep an operational
listing open unless I asked for a temporary test or retirement.
Use normal tools for my host. Ask only for missing information, keep keys
private and under my control, and leave simple operating commands.
```

You can name a host or let your agent help choose one. The agent handles configuration and verification where it has access, then shows you how to operate the service day to day. This is an agent workflow using normal tools, not a one-command installer.

[Agent instructions](docs/AGENT-SETUP.md) · [Manual setup](docs/JOIN.md) · [Fees and basics](TUTORIAL.md)

## Connect your operator in 3 steps

Once Kora is running at your public HTTPS URL:

1. **Register:** send your Kora URL to `POST https://api.mainnet-beta.neiropay.app/operators/register`.
2. **Host the proof:** serve the returned verification JSON at the specified path on your operator’s domain.
3. **Verify:** send the returned operator ID to `POST https://api.mainnet-beta.neiropay.app/operators/verify`. Once verification passes and your operator is eligible, the router can send it requests.

**The router brings the requests to you.** Once your operator is verified and eligible, the router automatically includes it when choosing an operator for clients using the network. You do not need to find users, connect to each app or route requests yourself. Keep Kora online and your SOL balance funded; you receive NEIRO for the transactions you sponsor, according to your fee settings.

Clients connect to one NEIRO router endpoint. The router helps them select an eligible operator by speed or price, so they do not need to discover operators themselves. Apps use the Kora payment flow described in the [client guide](https://github.com/bropump/neiro-kora-router-cloudflare#use-it).

Your agent can handle these steps. [Copy-paste API commands](docs/REGISTRATION.md) cover registration, checking eligibility and verifying again after upgrades or config changes.

## What you need

Run wherever official Kora runs; Mac, Docker and Bunny are examples, not requirements. Your agent adapts the setup using [upstream deployment guidance](https://solana.com/docs/tools/kora/operators#deployment) and the chosen host’s instructions.

You need a host that can run Kora, a dedicated operator wallet funded with SOL, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and public HTTPS hosting. Your HTTPS host must also serve the router's verification file. Follow upstream Kora's installation requirements for your chosen host; Docker is optional.

The template recommends a **0.25 SOL per-transaction allowance** and includes an editable **50% markup example**. Choose margin, fixed or free pricing. SOL pays transaction costs; NEIRO reimbursement does not automatically refill SOL. See [fees and operating basics](TUTORIAL.md).

**Both `signTransaction` and `signAndSendTransaction` are enabled by default.** Clients can receive a signed transaction to submit themselves or ask Kora to sign and submit it. Both methods enforce the operator's configured transaction and payment policies.

## Optional remote signing

**Solana Keychain is already built into Kora.** It is the signing interface Kora uses to connect to your operator wallet. There is no separate Keychain service or package to install.

Choose a local keypair or a remote signing backend supported by your Kora build in the standard `signers.toml`. The local option holds the key in Kora’s process; a remote signer keeps it outside the Kora host. Both use the same Kora payment flow.

Remote signing is optional and recommended for stronger key isolation. Its signing credentials still need protection and appropriate permissions. Your agent can help choose and configure the backend. [How Keychain and signer choices work](docs/SIGNING.md).

## Clients

[Build with NEIRO](docs/BUILD-WITH-NEIRO.md) · [Agent starting point](llms.txt)

Use `https://api.mainnet-beta.neiropay.app/rpc` as your Kora client endpoint. Choose `?selection=fastest` or `?selection=cheapest`, obtain a payer and quote, approve the fee, and keep the same provider through signing and submission. Clients do not register as operators.

[Client and router documentation](https://github.com/bropump/neiro-kora-router-cloudflare#use-it) · [Live network dashboard](https://api.mainnet-beta.neiropay.app/dashboard) · [Operator status API](https://api.mainnet-beta.neiropay.app/operators)

## Configuration and updates

Keep your settings in a private copy of the templates. Operators follow the latest successfully built official Kora main revision and pin each running deployment. Your agent handles updates and rollback with your host’s normal tools. Kora and its SDK remain unchanged.

The current recommendation uses `allowed_programs = "All"`. Read the [configuration notes](CONFIGURATION.md) for its sponsor exposure and the pending upstream protection.
