# Run an NPN operator with your agent

**You make the choices. Your agent installs and checks the service.** You do not need to edit configuration files yourself.

Your operator pays Solana transaction costs in SOL and receives the agreed NEIRO payment from customers. You run two things: **Kora**, which checks and sponsors transactions, and the **listing runner**, which publishes your signed address and fee terms so clients can find you.

Only want to pay in NEIRO or build an app? Use the [client / builder guide](docs/BUILD-WITH-NEIRO.md); you do not need to run an operator.

## 1. Choose where to run it

Tell your agent which machine to use: **your Mac, Windows PC, Linux server, Raspberry Pi or cloud host**. If you have no preference, say “help me choose a host within my monthly budget”.

Your own computer must stay on, connected and awake to serve customers. Cloud hosting can keep it online independently of your computer and has its own bill. Your agent checks the machine’s architecture and supported Kora installation before proceeding. Give it access through your normal local or hosting tools.

**You provide:** the device or hosting account, access and any monthly spending limit. **Your agent handles:** installation, networking and service startup.

## 2. Choose the operator wallet

Ask your agent to **create a dedicated operator wallet**, or tell it which existing dedicated wallet or signing provider to use. This wallet spends SOL and receives NEIRO.

A local signer keeps signing access on the host; a remote signer uses a separate signing service. Your agent checks that the selected signer works with both Kora and the listing runner. Ask it to explain recovery and backup before you fund the wallet. Keep your private key, recovery phrase and service credentials out of chat and GitHub.

**You provide:** the wallet/signer choice and private access through your tools. **Your agent handles:** connecting it and confirming the public address.

## 3. Set your fees

Tell your agent which price you want:

- **Cost plus a markup:** “Charge cost plus 20%.” A calculated cost worth 10 NEIRO becomes a 12 NEIRO quote. The percentage applies to sponsored cost, not the customer’s transfer amount.
- **Fixed NEIRO:** “Charge 10 NEIRO per transaction with strict cost checking.” More expensive transactions are rejected rather than covered at that fixed price.
- **Free:** “Sponsor transactions for free.” You pay the costs and receive no reimbursement.

The markup is gross revenue before running costs and price changes, not guaranteed profit. Your agent applies your choice and publishes matching signed terms. Later, ask it to update both the running configuration and the onchain listing. [Technical pricing and limits](CONFIGURATION.md).

## 4. Set your budget and connect the services

Tell your agent **how much SOL you want to fund**, your hosting budget, and the limits for a test payment. Ask it to explain the per-transaction spending limits before applying them; those limits are not a daily budget or a guarantee against losses.

Your agent checks what you already have and guides you through anything missing:

| What you need | Why | Your action |
|---|---|---|
| Solana RPC access | Reads the chain and sends transactions. | Reuse an account or sign up with a provider your agent helps you choose. Give access through private storage. |
| Jupiter API key | Supplies token prices for the current NEIRO pricing configuration. | Reuse your account or have your agent guide you through obtaining access. Store the key privately. |
| Public HTTPS address | Lets customers connect securely to your operator. | Choose a hostname you control or a suitable hosting-provided address. Your agent sets up HTTPS. |
| SOL in the operator wallet | Pays sponsored costs, listing rent and network fees. | Fund the public address only after your agent verifies it, within your chosen budget. |
| NEIRO for a test customer | Pays for the small test that proves reimbursement works. | Choose a separate customer wallet and approve its test amount and maximum fee. |

The operator needs a **NEIRO receiving account**, which your agent prepares; it does **not** need an initial NEIRO balance. There is no network-set operating deposit. Funding depends on your workload; your agent should explain its estimate. [RPC options](docs/OPERATOR-SETUP.md#free-rpc-options).

## 5. Give your agent the setup brief

Copy the [brief on the front page](README.md#set-up-your-operator), fill in what you know, and leave “help me choose” for anything uncertain. The agent follows [AGENTS.md](AGENTS.md) for the exact installation and verification steps.

It should explain progress as it:

1. **Installs Kora and the listing runner.** These serve payments and keep your public listing current.
2. **Protects your listing before serving requests.** Public signing requests must not be able to modify your operator listing; the agent tests the running protection.
3. **Publishes your URL and signed fees on Solana.** Clients can discover and verify your terms without registering with a router.
4. **Proves a payment.** You see the confirmed transaction, the NEIRO charge and the operator’s SOL/NEIRO changes, within your agreed limits.
5. **Leaves the service running and monitored.** It shows restart checks, automatic listing renewal, upstream update checks, alerts, and your exact stop/start/status commands. Unobserved checks stay marked incomplete.

## After setup

Keep the host online, monitor its SOL and replenish it when needed. **SOL goes out; NEIRO comes in.** NEIRO reimbursement does not automatically refill SOL. A failed onchain transaction can still charge network fees while the NEIRO payment rolls back.

The runner renews unchanged terms after 24 chain hours; clients reject them after 48 hours without renewal. Your agent sets this up and explains alerts. Publishing a listing does not guarantee traffic or profit.

[Technical operator procedure](AGENTS.md) · [Hosting details](docs/OPERATOR-SETUP.md) · [Fees and permissions](CONFIGURATION.md) · [Renewal and recovery](docs/RENEWAL.md)
