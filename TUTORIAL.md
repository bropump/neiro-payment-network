# Run a NEIRO operator

1. **Prepare your host.** Keep it online and provide a stable HTTPS endpoint. Use the pinned stock Kora release and your own Solana RPC/pricing credentials.
2. **Choose your economics.** Configure margin, fixed-price or free sponsorship in `[validation.price]`. Choose the per-transaction allowance separately. Check a real Kora quote rather than assuming the exact fee from the setting alone.
3. **Protect and fund the payer.** Use a dedicated wallet. Keep its private key on the host. Provide enough SOL for network fees and sponsored account creation; customers reimburse in NEIRO.
4. **Start Kora.** Follow the [manual setup commands](docs/JOIN.md) and read the [configuration risks](CONFIGURATION.md) before funding the broad-program template.
5. **Join the router.** [Submit your HTTPS URL and host the ownership proof](docs/REGISTRATION.md). No on-chain registration or daily renewal is required.
6. **Verify service.** Check eligibility, request a quote, then perform a small payment within your budget. Confirm the on-chain result and recover test funds or account rent where possible.

## Keep it running

Monitor SOL balance, request failures and RPC/pricing quotas. NEIRO earnings do not automatically refill SOL. Validate and restart Kora after changing its fees. Keep the public proof file available; use the removal procedure when leaving.

Operators pay hosting and RPC costs, and failed transactions may spend SOL. Being registered does not guarantee traffic or profit. Spending allowances are per transaction, not daily budgets. Your endpoint remains directly callable, so configure your own public-service protections.
