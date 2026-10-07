# Optional independent routers

The network does not require a router. Operators [publish their own SPL Records](REGISTRATION.md); clients discover and authenticate those records through Solana RPC and request Kora quotes directly.

Anyone can build a router or indexer on the same public records to help clients discover operators, cache listings or compare quotes. That service is optional. A client can choose another service or perform the same work itself, without a central registration step.

A router must validate the v5 listing format, authority, signature and finalized block anchor, reject records at 48 hours and all legacy formats, obtain live balances and quotes, and label the operators and time window it compared. “Fastest” depends on where the measurement runs; a router's fastest operator need not be the client's fastest. “Cheapest” depends on the complete transaction and current pricing inputs.

Clients must still independently verify the selected listing, quoted fee and exact transaction before signing, and keep the chosen operator pinned through submission. A router cannot make an unverified fee trustworthy merely by recommending it.

This describes the onchain discovery architecture; it does not establish that any older router deployment already supports this listing format.
