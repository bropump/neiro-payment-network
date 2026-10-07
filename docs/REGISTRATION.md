# Publish your operator onchain

The network uses operator listings in SPL Record. Clients discover them through Solana RPC and call each operator's Kora endpoint directly. There is no required router registration, hosted proof file or central operator directory API.

## What gets created

The existing SPL Record program is `recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5`. **Each operator creates its own record account under that program.** The network directory is the collection of valid records in our shared `NEIRO069` format, not one shared account containing everybody's entry. No master record or new program deployment is required before the first operator publishes.

The current publisher derives each listing from the operator public key and the fixed seed `neiro-kora-fees`. That binding is part of client authentication. An arbitrary or vanity record address is not accepted by this format merely because it contains the same JSON.

## Publish

Follow the [agent setup](AGENT-SETUP.md) or [manual setup](JOIN.md) to install stock Kora and the portable Node.js publisher, configure signing and funding, and expose a stable HTTPS endpoint.

1. Derive your listing address without loading a signer:

   ```sh
   node runner.mjs address --operator OPERATOR_PUBLIC_KEY
   ```

2. Append the printed **listing address (not your wallet address)** to `[validation].disallowed_accounts` in your private `kora.toml`, preserving other entries. Restart **every public Kora instance sharing the signer**. Verify the loaded settings and that signing requests touching this account are rejected. Block your listing account, not the entire SPL Record program.
3. From the private deployment directory, using the operator's configured signer environment, publish:

   ```sh
   node runner.mjs publish --operator OPERATOR_PUBLIC_KEY --url https://OPERATOR_HOST/ --state-dir /PRIVATE/renewal
   ```

The command also migrates older listings in the same derived account to mandatory v5. It obtains a finalized block anchor; operators do not choose expiry timestamps. The command checks the live operator identity, payment address, NEIRO acceptance, pricing and deny entry before signing. It then creates the account and writes the advertised terms in an onchain transaction. Publication costs a transaction fee and a refundable rent deposit. Keep signing credentials private. If submission times out, reconcile the signature in the journal before retrying.

## Check discovery and quotes

Read the finalized record back and authenticate it using the [listing format and RPC filters](SPL-RECORD-LISTINGS.md#discovery-and-client-checks). A client scans for listings, reads live operator SOL balances, and requests quotes directly from the listed HTTPS endpoints. It verifies each quote against the advertised terms and independent pricing inputs before signing the exact transaction.

“Fastest” is the first fully verified quote received by that client. “Cheapest” is the lowest verified quote among the operators successfully compared for that transaction within the client's deadline. Neither is a claim the record itself proves. Keep the selected operator pinned through transaction preparation, signing and submission.

Test publication is distinct from operating a production provider. Close disposable test listings after verification unless the user explicitly requests retention. A retained test listing is publicly discoverable; neither publication nor a passing test certifies production readiness. An operating provider must maintain its own listing and endpoint.

## Change terms or leave

After changing fees or the endpoint, restart Kora as needed, verify the running configuration, and run `publish` again using the same private state directory. The same listing address is updated. Clients must reject mismatches during the changeover. Unchanged v5 terms younger than 24 chain hours send no transaction; changed terms update immediately.

Every operator must enable [automatic renewal](RENEWAL.md). `renew --watch` checks hourly, or an hourly native timer invokes `renew --url https://OPERATOR_HOST/ --state-dir /PRIVATE/PERSISTENT/PATH`; the worker locks its state and reconciles pending sends before proceeding. It renews after 24 chain hours, while clients reject a listing at 48 hours from the finalized anchor block time. The signed fields are `anchor_slot` and `anchor_blockhash`, not an operator-selected expiry. Expired accounts remain onchain until closed. Clients also skip unreachable operators and reject invalid quotes. Timers cannot guarantee uninterrupted eligibility during outages.

To retire the listing and recover its rent, disable the sole renewal worker first, wait for it to stop and reconcile any pending submission. Otherwise it can recreate a closed listing. Then run:

```sh
node runner.mjs close --operator OPERATOR_PUBLIC_KEY --state-dir /PRIVATE/renewal
```

Confirm finalized closure. Network fees are not refundable. No token accounts are created or closed by the publisher. Leave a production listing open while the operator is available.
