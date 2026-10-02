# Run Kora with the NEIRO config

Give your agent the [setup prompt](../README.md#ask-your-agent-to-set-it-up). It should guide you through these steps and handle the commands for your host.

## Get it working

1. Install [official Kora](https://solana.com/docs/tools/kora/operators) wherever you want to run it. Use the latest successfully built official main revision and pin that build.
2. Put [kora.toml](../examples/operator/kora.toml) and [signers.toml](../examples/operator/signers.toml) in one private folder. Choose your fee at the top of `kora.toml`; the comments explain the options.
3. Supply your upstream Solana mainnet `RPC_URL` and `JUPITER_API_KEY` through private storage. For the example local signer, `KORA_PRIVATE_KEY` contains the keypair data, not a filename. [Remote signing](SIGNING.md) is optional.
4. Fund your dedicated payer with SOL and prepare its NEIRO account to receive fees. Have the agent show the public payer, mainnet network and NEIRO mint before transferring funds. The router does not require a fixed SOL/NEIRO deposit. Keep enough SOL for your intended workload; NEIRO revenue does not automatically refill it.
5. Validate and start Kora with your private files:

```sh
kora --config /path/to/kora.toml config validate --signers-config /path/to/signers.toml
kora --config /path/to/kora.toml rpc start --signers-config /path/to/signers.toml
```

6. Expose HTTPS with two routes: the Kora API and its static verification file. Your agent should use your host's ingress or the [proxy example](HTTPS.md). A tunnel pointing only at Kora cannot serve the file.
7. Use `https://api.mainnet-beta.neiropay.app` as the router base and `/rpc` for Kora clients. Follow [register → host proof → verify](REGISTRATION.md). Check that the router reports your operator as eligible and that an unsigned quote succeeds through your operator's router URL.

Kora’s `RPC_URL` must point to your Solana RPC provider, not the NEIRO router. Kora needs the signer and RPC/Jupiter credentials; the router never needs your private key. The public router does not supply provider API credentials. Keep Kora's transaction policies and request limits.

## Keep it running

Once connected, let the agent arrange automatic restart and upstream update checks using your host's normal tools. Keep the same private config and signer, validate before upgrades and retain the previous build for rollback. Check updates every five minutes; after replacing a build or changing fees, restart successfully and [verify again](REGISTRATION.md#after-an-upgrade-or-config-change).

Ask the agent to leave exact status, logs, stop, restart, update and balance-check commands. Check SOL liquidity and RPC/Jupiter quotas. The router checks compatibility and health, not whether you run the latest upstream revision.
