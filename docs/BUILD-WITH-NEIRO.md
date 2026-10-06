# Build with NEIRO

Keep your Solana app. Let an independent Kora operator supply SOL for the transaction and receive NEIRO covering the gas and their tip.

## Start with a payment

1. Ask what the user wants to send, its amount, the recipient and the wallet they already use. Reuse the existing code and wallet adapter.
2. Read the [current router client documentation](https://github.com/bropump/neiro-kora-router-cloudflare#use-it) and [official Kora transaction walkthrough](https://solana.com/docs/tools/kora/guides/full-demo).
3. Connect the Kora client to `https://api.mainnet-beta.neiropay.app/rpc`. Keep a separate Solana RPC for account reads, blockhashes and confirmation.
4. Discover an eligible operator and pin it for this flow, following the router's current provider selection instructions. Use that operator as transaction fee payer. Keep application/token authorities with the user's wallet.
5. Build the user's transaction, including required recipient account creation. Use the current Kora SDK payment-instruction flow to estimate costs and add reimbursement in NEIRO, mint `CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump` (6 decimals). Recheck the completed transaction's quote and policies. Do not hardcode the homepage's base estimate as the final fee.
6. Show the payment amount, recipient, NEIRO reimbursement including the operator tip, and any account deposits. Obtain wallet approval before signing the final message.
7. Submit the wallet-signed transaction through the same operator using the documented signing/submission flow. Follow confirmation with Solana RPC and return an [Orb](https://orbmarkets.io) transaction link.

If the user asks only for a quote, stop before signing or submitting. If no eligible operator is listed, report it; do not invent a quote or silently switch to spending the user's SOL.

## Give an agent a wallet

Use the [PaySponge SDK](https://github.com/paysponge/paysponge-sdk) and its current signing documentation. Connect or create the user's chosen agent wallet, keep credentials private, and read its Solana public address. Prepare the complete sponsored transaction first. Use Sponge to sign it, preserving the operator fee payer and every instruction, then submit through that pinned NEIRO operator.

Start with a small, approved payment and verify the recipient balance and Orb receipt. Wallet access is separate from permission to spend. For swaps and other operations, reuse the same signing adapter with the appropriate Solana instructions.

## Add a Jupiter swap

Follow [Jupiter's current instruction-building guide](https://developers.jup.ag/docs/guides/how-to-build-a-custom-swap-with-metis). Get a fresh quote and buildable swap instructions. Preserve the user's swap authority, route, minimum output, lookup tables, compute budget, setup and cleanup. Set the operator as fee payer and account funder where required. Add the NEIRO reimbursement before final wallet approval, then submit through the pinned operator. Show swap amounts, slippage and the full gas quote together.

## More recipes

- [MiniRouter agent payments](https://minirouter.sh/docs/agent-payments): fund the service, reconcile credit and verify the paid model response. A swap receipt alone does not prove service credit.
- [Classic SPL token creation](https://solana.com/docs/tokens/basics/create-mint): preserve mint authority, include mint/account creation costs in the sponsorship quote and verify the resulting supply.
- [x402](https://solana.com/docs/payments/agentic-payments/x402) and [MPP](https://solana.com/docs/payments/agentic-payments/mpp): preserve the service challenge, recipient and payment asset. Confirm that the payment verifier accepts the sponsored transaction format. NEIRO gas does not change the asset a merchant requests.
- [NEIRO ID](https://github.com/bropump/neiro-id): register or resolve an onchain name using that project's public protocol. Resolve the destination before building a payment.

## Test and return funds

Agree a small budget before sending. Record every created token account, its owner and rent funder. After a disposable test, return remaining assets when authorized and close newly created empty accounts whose authority the user controls, returning rent to the funder. Do not close existing user accounts or burn non-test assets. A classic mint itself has no ordinary close instruction.

Report what was actually checked: quote, simulation, local fork, mainnet confirmation or paid service response. Preserve transaction receipts. No hosted service, launchpad or facilitator is proven by a plain transfer test.
