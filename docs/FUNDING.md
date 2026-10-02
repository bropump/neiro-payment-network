# Wallet funding and fees

| Who | Needs |
| --- | --- |
| Operator | Mainnet SOL to pay network fees and sponsored account rent; a NEIRO token account to receive fees |
| Paying customer | Enough NEIRO for the actual quote, plus the assets their transaction uses |

The operator does not need to buy a fixed amount of NEIRO just to register. The NEIRO receipt account must be prepared for your payment flow. A user choosing free sponsorship intentionally receives no fee. Registration and the unsigned sample quote do not move funds. Creating token accounts or running real payment tests does.

## Before funding

Have the agent show **public information only**:

1. The network: Solana mainnet. Check the RPC genesis hash is `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
2. The dedicated operator public key, derived from its signer. It must match Kora's `getPayerSigner` response. If a separate payment address is configured, identify it too.
3. The NEIRO mint: `CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump`, with six decimals. Use the mint address, not a token name or symbol found in search.
4. The canonical associated token account for the payment recipient and this mint. Check its mint and owner on chain; if missing, the agent should prepare it with standard Solana/SPL tooling within your approved spending scope. Do not send NEIRO to an arbitrary address presented as an account.

Agree the initial SOL amount and source wallet before any transfer. Send only intended operating funds to the confirmed payer address. After funding, check the on-chain SOL balance and token-account state. If a submitted transaction's result is unclear, reconcile its signature before repeating it.

## How much SOL?

Choose liquidity for your workload and replenish it as SOL is spent. The 0.25 SOL setting is an allowance per transaction, not a required deposit or daily budget. An operator with less available SOL cannot cover a transaction needing more. Failed transactions can still cost fees. NEIRO revenue stays NEIRO unless you separately convert it; the service does not refill SOL automatically.

Have the agent show how to check both balances using your host's wallet tools or block explorer and choose a low-SOL notification threshold. A notification needs a real monitoring destination; a log file alone will not notify you.

## How much to charge?

Choose one pricing mode at the top of your private `kora.toml`:

- **Margin:** `type = "margin"`, `margin = 0.20` charges sponsored cost plus 20%. Cost worth 10 NEIRO becomes 12 NEIRO. `0.0` means cost only.
- **Fixed:** `type = "fixed"`, `amount = 10000000`, the NEIRO mint as `token`, and `strict = true` charges a total of 10 NEIRO and rejects estimated costs above it. Six decimals means 1 NEIRO = 1,000,000 units. `strict = false` means you can subsidize a shortfall.
- **Free:** `type = "free"` means you pay the SOL cost and receive no reimbursement.

Replace the old pricing fields when switching modes. [Full examples](../TUTORIAL.md#3-set-your-fees). Validate, restart, verify with the router and obtain a fresh quote after changing fees. The markup is on the cost you sponsor, not the customer's transfer amount.
