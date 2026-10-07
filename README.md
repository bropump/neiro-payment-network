<p align="center">
  <a href="https://bropump.com"><img src="https://images.bropump.com/neiro_logo_small.png" alt="NEIRO" width="120"></a>
</p>

# NEIRO GAS Network

## Solana transactions. Gas paid in NEIRO.

The NEIRO GAS Network is an open network of payment sponsor operators running [Kora](https://github.com/solana-foundation/kora). Operators pay transaction fees in SOL and receive payment in NEIRO. You choose your fees, host and wallet. Operators publish onchain listings; clients discover them through Solana RPC and compare quotes directly.

Integrated clients and apps can let users pay transaction fees in NEIRO without maintaining a separate SOL balance for sponsored transactions. Transactions still run and settle on Solana.

Our testing has included x402, MPP, Jupiter swaps, transfers and trades.

Run Kora, accept NEIRO for transaction fees, and publish an onchain listing for direct discovery. This repository provides configuration, setup guidance and the small listing publisher. Kora itself remains the official upstream software.

**Start with the [official Kora deployment guide](https://solana.com/docs/tools/kora/operators#deployment).** Follow it to install and run Kora on your chosen host, use our [NEIRO configuration](examples/operator/kora.toml) and [signer template](examples/operator/signers.toml), then follow the [agent setup](docs/AGENT-SETUP.md) to publish and verify your operator.

## Onchain operator discovery

Each operator publishes its own account under the existing SPL Record program using our shared listing format. Clients scan those accounts, verify identity and fee terms, check live SOL balances, and call operators directly. There is no master directory account to create and no required router or central registration API.

The [standalone Rust publisher](docs/SPL-RECORD-LISTINGS.md) creates, updates and closes listings while keeping official Kora unchanged. Protect each operator's listing account in Kora before publishing. Every operator uses anchored v5 listings, renewed after 24 hours and rejected by clients 48 hours after the finalized anchor block time. The account remains onchain until closed; clients still measure availability and verify live quotes.

## Ask your agent to set it up

Give your coding agent this repository and paste:

```text
Set up a NEIRO Kora operator on my chosen host using this repository.
Follow AGENTS.md and docs/AGENT-SETUP.md through to verified operation.
Build unchanged Kora and the Rust listing publisher, configure my signer,
check SOL and NEIRO accounts, derive and deny my listing address in
kora.toml before starting Kora, then sign and publish my SPL Record terms.
Install the required daily renewal using my host's hourly service timer,
with private persistent state; verify the fixed 48-hour client expiry.
Verify direct discovery, the loaded deny rule and independent quote checks.
Use my existing permissions and payment limits for any live test, recover
test funds as requested, and report receipts and costs. Keep an operational
listing open unless I asked for a temporary test or retirement.
Use normal tools for my host. Ask only for missing information, keep keys
private and under my control, and leave simple operating commands.
```

You can name a host or let your agent help choose one. The agent handles configuration and verification where it has access, then shows you how to operate the service day to day. This is an agent workflow using normal tools, not a one-command installer.

[Agent instructions](docs/AGENT-SETUP.md) · [Manual setup](docs/JOIN.md) · [Fees and basics](TUTORIAL.md)

## Publish your operator

1. Build Kora and the publisher, configure signing and funding, and expose HTTPS.
2. Derive the listing address, deny it in every public Kora instance sharing the signer, restart and verify protection.
3. Sign and publish the operator's terms, then verify chain discovery and direct quotes.
4. Install the [hourly renewal check](docs/RENEWAL.md) with private persistent state; unchanged terms renew only when 24 chain hours have elapsed.

[Publication commands](docs/REGISTRATION.md) · [Complete agent workflow](docs/AGENT-SETUP.md)

Publication deposits refundable rent and pays a transaction fee. A working operator maintains its listing and endpoint. Test listings are normally closed for cleanup unless explicitly retained. Listing an operator does not guarantee traffic or certify its safety.

## What you need

Run wherever official Kora runs; Mac, Docker and Bunny are examples, not requirements. Your agent adapts the setup using [upstream deployment guidance](https://solana.com/docs/tools/kora/operators#deployment) and the chosen host’s instructions.

You need a host that can run Kora, a dedicated operator wallet funded with SOL, a NEIRO token account for reimbursement, Solana RPC access, a Jupiter pricing key and public HTTPS hosting. Follow upstream Kora's installation requirements for your chosen host; Docker is optional.

The template recommends a **0.25 SOL per-transaction allowance** and includes an editable **50% markup example**. Choose margin, fixed or free pricing. SOL pays transaction costs; NEIRO reimbursement does not automatically refill SOL. See [fees and operating basics](TUTORIAL.md).

**Both `signTransaction` and `signAndSendTransaction` are enabled by default.** Clients can receive a signed transaction to submit themselves or ask Kora to sign and submit it. Both methods enforce the operator's configured transaction and payment policies.

## Optional remote signing

**Solana Keychain is already built into Kora.** It is the signing interface Kora uses to connect to your operator wallet. There is no separate Keychain service or package to install.

Choose a local keypair or a remote signing backend supported by your Kora build in the standard `signers.toml`. The local option holds the key in Kora’s process; a remote signer keeps it outside the Kora host. Both use the same Kora payment flow.

Remote signing is optional and recommended for stronger key isolation. Its signing credentials still need protection and appropriate permissions. Your agent can help choose and configure the backend. [How Keychain and signer choices work](docs/SIGNING.md).

## Clients

[Build with NEIRO](docs/BUILD-WITH-NEIRO.md) · [Agent starting point](llms.txt)

Discover listings through Solana RPC, authenticate them, and call the listed Kora endpoints directly. Choose the first fully verified quote for fastest response, or compare verified total fees for cheapest among responding candidates. Read SOL balances live. Approve the exact transaction and fee, then keep the same operator through signing and submission.

[Discovery format and client checks](docs/SPL-RECORD-LISTINGS.md#discovery-and-client-checks) · [Optional independent routers](docs/ROUTER.md)

## Configuration and updates

Keep your settings in a private copy of the templates. Operators follow the latest successfully built official Kora main revision and pin each running deployment. Your agent handles updates and rollback with your host’s normal tools. Kora and its SDK remain unchanged.

The current recommendation uses `allowed_programs = "All"`. Read the [configuration notes](CONFIGURATION.md) for its sponsor exposure and the pending upstream protection.
