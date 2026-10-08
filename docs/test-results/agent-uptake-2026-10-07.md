# Fresh-agent uptake tests — 7 October 2026

Historical test evidence for the versions and environment below. For current instructions, use the [client / builder guide](../BUILD-WITH-NEIRO.md) or [operator setup](../../AGENTS.md).

Three agents started without conversation history, worked on separate wallet paths and chose operations, and worked from the public guide and its links. No new NPN SDK or CLI was built. The parent supplied shared Surfpool, two unchanged Kora instances, synthetic funds and an explicit local endpoint map. This is an assisted integration study, not a measurement of fully independent infrastructure setup.

## What actually worked

| Wallet path | Operation | Result |
| --- | --- | --- |
| **Real PaySponge test wallet** | Create classic SPL mint, create ATA, mint 123 tokens, pay operator in NEIRO | Finalized; remote signature and existing mint signature preserved; user SOL stayed zero. |
| Privy path → **local signer fallback** | Send 1 NEIRO and create recipient ATA | Finalized; user SOL stayed zero. No Privy test credentials were available, so Privy service signing is **untested**. |
| Turnkey path → **local signer fallback** | Send 10,000 lamports principal plus memo; pay gas in NEIRO | Finalized; user's SOL covered exactly the principal, no gas. No Turnkey test credentials were available, so Turnkey service signing is **untested**. |

The parent independently fetched all three finalized transactions from Surfpool, verified every required signature and checked sponsor SOL outflow and NEIRO reimbursement against the agents' calculations. [Machine-readable receipt checks](agent-uptake-2026-10-07.json). These signatures belong to the local fork; public explorers cannot verify them.

## Changes supported by the attempts

1. **Use existing libraries and plain Kora JSON-RPC.** One agent hit conflicting peer dependencies when combining current Kora/Kit/program packages, then disk exhaustion. Its successful fallback used existing web3.js/SPL libraries and ordinary HTTP calls. The main guide now names the RPC methods and parameters. No Kora SDK or Keychain installation is required just to call Kora.
2. **Treat helper reimbursement as provisional.** The transfer's helper amount was 2,254,263 raw NEIRO; its completed-message verified quote was 2,254,208. Mint creation similarly changed from 3,691,727 to 3,691,674. Both agents corrected the reimbursement instruction and re-quoted before signing. The guide now specifies a bounded correction loop, without guessing the internal cause of the difference.
3. **Build and quote before collecting final signatures.** A pause after remote signing let a blockhash expire. Kora rejected it before broadcast; rebuilding, re-quoting and obtaining fresh signatures succeeded. Another agent's ten-second finality wait timed out, but reconciling the original signature found success without a duplicate payment. The guide preserves that distinction.
4. **Record the actual wallet API and coverage.** A local fallback can prove transaction construction, not a remote provider's signing policies. Missing credentials are a setup blocker, not evidence of incompatibility. The existing capability checklist already expresses the essential requirements; a wallet-brand catalogue would not solve the observed problems.

## PaySponge reproducibility

Tested packages: `@paysponge/sdk 0.1.147`, `@solana/kora 0.2.1`, `@solana/web3.js 1.99.0`, `@solana/spl-token 0.4.15`, `tweetnacl 1.0.3`. These are observed test versions, not a requirement to replace an application's dependency set.

The agent used the provider's documented self-registration with `testnet: true`, then its sign-only endpoint:

```text
POST https://api.wallet.paysponge.com/api/solana/sign
Authorization: Bearer <private test credential>
Content-Type: application/json

{"transaction":"<base64 partially signed transaction>","agentId":"<test agent ID>"}
```

The response included `signedTransaction`, `signature`, `from` and `chain`. The agent decoded the transaction, checked unchanged message bytes and the existing mint signature, verified the new wallet signature, then obtained Kora's signature and submitted through the local Solana RPC. This does not establish browser-wallet, Para, mainnet or arbitrary-program compatibility. No provider secrets or recovery codes are published here.

## Observed time

| Attempt | Start to successful evidence | Separately measured phases |
| --- | --- | --- |
| Privy/local fallback | 345.6 seconds | Dependency install 8.3 s; corrected discovery/authentication 61.5 ms; submission through confirmation 557.6 ms. |
| PaySponge service | About 6 min 54 s | Dependency install 33 s; registration 1,165 ms; successful remote signing 844 ms; Kora signing/submission/confirmation 317 ms. |
| Turnkey/local fallback | 511.2 seconds | Discovery/authentication 148.6 ms; parallel quotes and verification 49.6 ms; co-signing/submission 38.3 ms, excluding finality reconciliation. |

These are single observations including reading, credential checks, coding, debugging and evidence collection. The PaySponge total uses wall-clock checkpoints; API phases and other reported durations use same-clock monotonic differences. An invalid mixed Python/Node clock entry was excluded. Infrastructure was supplied while agents read, so these are not zero-to-installed-network times. Local fork timings are not mainnet or production latency estimates. There is no measured before/after onboarding speedup from the documentation edits.

## Scope and cleanup

All three initially received a stale rendered GitHub page. They subsequently compared the current guide at commit `007b02d`, SHA-256 `ea3b24a2210b53af59430770de2f0957e71f1a0560985770a42577a67b26db00`. Findings about the removed wallet catalogue were excluded from current-guide defects. They did not reuse the earlier transfer harness; the parent supplied fixture details and reminded the PaySponge agent to preserve additional signatures.

Both Kora instances used the previously tested image digest `sha256:fc465ca4fc97f317f1cdb857dde382ff0ad306af81d287d7805bba67ca35c247`. The Mock oracle conversion was 0.001 SOL per NEIRO. Test HTTPS names were explicitly mapped to localhost; production operator URLs were excluded. Jupiter price quality and public routing were not exercised.

The PaySponge run did not implement complete production selection safeguards (including a final listing re-read and explicit batched capacity checks). Its cleanup quote also lacked an independent refund-aware cost calculation. These are limits of that disposable harness, not security checks to omit from a client. The primary mint transaction's quote was independently verified.

The transfer test returned principal and closed its new ATA, refunding 2,039,280 lamports. PaySponge burned only its newly created test tokens, closed its created and fixture token accounts, and returned remaining synthetic NEIRO. Its classic mint retained 1,461,600 synthetic lamports because classic mints have no ordinary close instruction. The parent closed both test listings and stopped the test services after verification. No mainnet funds or production operator configuration changed; remote test-wallet recovery access remains private.

A separate agent reviewed the guide changes: raw RPC calls and helper distinction checked, 104 existing reader/quote tests passed, and `git diff --check` passed. Review suggestions to specify raw token units and blockhash ordering were incorporated.
