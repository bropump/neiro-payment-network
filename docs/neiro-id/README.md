# NEIRO ID

An onchain name for people and agents. NEIRO ID connects a readable name to a Solana wallet for discovery, tipping and payments through existing apps.

- [Agent instructions](NEIRO-ID-AGENTS.txt): register, resolve, update and release a name.
- [Public protocol configuration](neiro-id-agent-protocol.json): the active mainnet namespace and record format.
- [Reference resolver](neiro-id-resolver.mts): optional TypeScript name lookup.

Use these public files with your own agent and wallet. The namespace creation seed in the configuration is deliberately public protocol material; never fund that shared address. Your private wallet controls your name record.

The mac and guest examples in the instructions are historical tests whose names have been released. Resolve current onchain state before using any destination.
