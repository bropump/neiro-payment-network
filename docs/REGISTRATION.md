# Publish your operator onchain

The network uses operator listings in SPL Record. Clients discover them through Solana RPC and call each operator's Kora endpoint directly. There is no required router registration, hosted proof file or central operator directory API.

## What gets created

The existing SPL Record program is `recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5`. **Each operator creates its own record account under that program.** The network directory is the collection of valid records in our shared `NEIRO069` format, not one shared account containing everybody's entry. No master record or new program deployment is required before the first operator publishes.

The current publisher derives each listing from the operator public key and the fixed seed `neiro-kora-fees`. That binding is part of client authentication. An arbitrary or vanity record address is not accepted by this format merely because it contains the same JSON.

## Publish

Follow the [agent setup](AGENT-SETUP.md) or [manual setup](JOIN.md) to build stock Kora and the standalone Rust publisher, configure signing and funding, and expose a stable HTTPS endpoint.

1. Derive your listing address without loading a signer:

   ```sh
   neiro-kora-publisher --operator OPERATOR_PUBLIC_KEY address
   ```

2. Append the printed **listing address (not your wallet address)** to `[validation].disallowed_accounts` in your private `kora.toml`, preserving other entries. Restart **every public Kora instance sharing the signer**. Verify the loaded settings and that signing requests touching this account are rejected. Block your listing account, not the entire SPL Record program.
3. From the private deployment directory, using the operator's configured signer environment, publish:

   ```sh
   neiro-kora-publisher --operator OPERATOR_PUBLIC_KEY publish --url https://OPERATOR_HOST/ --journal listing-create.json
   ```

The command checks the live operator identity, payment address, NEIRO acceptance, pricing and deny entry before signing. It then creates the account and writes the advertised terms in an onchain transaction. Publication costs a transaction fee and a refundable rent deposit. Keep signing credentials private. If submission times out, reconcile the signature in the journal before retrying.

## Check discovery and quotes

Read the finalized record back and authenticate it using the [listing format and RPC filters](SPL-RECORD-LISTINGS.md#discovery-and-client-checks). A client scans for listings, reads live operator SOL balances, and requests quotes directly from the listed HTTPS endpoints. It verifies each quote against the advertised terms and independent pricing inputs before signing the exact transaction.

“Fastest” is the first fully verified quote received by that client. “Cheapest” is the lowest verified quote among the operators successfully compared for that transaction within the client's deadline. Neither is a claim the record itself proves. Keep the selected operator pinned through transaction preparation, signing and submission.

Test publication is distinct from operating a production provider. Close disposable test listings after verification unless the user explicitly requests retention. A retained test listing is publicly discoverable; neither publication nor a passing test certifies production readiness. An operating provider must maintain its own listing and endpoint.

## Change terms or leave

After changing fees or the endpoint, restart Kora as needed, verify the running configuration, and run `publish` again with a fresh journal path. The same listing address is updated. Clients must reject mismatches during the changeover. Unchanged terms send no transaction.

Listings have no expiry or daily renewal. An offline operator's record can remain onchain; clients skip unreachable operators and reject invalid quotes. Being listed is not a guarantee of availability or safety.

To retire the listing and recover its rent:

```sh
neiro-kora-publisher --operator OPERATOR_PUBLIC_KEY close --journal listing-close.json
```

Confirm finalized closure. Network fees are not refundable. No token accounts are created or closed by the publisher. Leave a production listing open while the operator is available.
