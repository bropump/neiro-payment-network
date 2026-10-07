# Join the NEIRO GAS Network

Follow the [setup guide on the main page](../README.md#set-up-your-operator). It contains the installation and operating commands in order:

1. Install the Node listing script alongside stock Kora.
2. Run `protect` to add your listing address to `kora.toml`.
3. Restart every Kora instance using that key.
4. Run `renew --watch` as one persistent service.

There is no central registration service. Each operator publishes its own signed SPL Record listing, and clients discover it through Solana RPC.
