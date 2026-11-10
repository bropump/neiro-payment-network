# Kora operator update — 10 November 2026

## Deployed revision

- Official upstream main: `1844c14741866bd654f7e426c418c769cfda67ab`.
- Immutable image: `ghcr.io/solana-foundation/kora@sha256:b3337ff3018e826221c9341b1578a5b68f2ddcd3e3a872eda0fde5e75fc03d47`.
- Previous image: `ghcr.io/solana-foundation/kora@sha256:fc465ca4fc97f317f1cdb857dde382ff0ad306af81d287d7805bba67ca35c247`.
- Bunny regions: Germany (DE), New York (NY), Sydney (SYD), all active with ready containers on the target digest.
- Payer: `S42G16e52WiSRuBS49DNSNsWEx1CmysRfmuguEbotyg`. Payment identity and existing public fee/spending settings were preserved, including margin 1.0, 0.25 SOL allowance, 100,000-lamport priority cap and protected listing account.
- Newly exposed upstream default: `fee_payer_policy.token_2022.allow_reallocate = false`.

## Request limits

Both `[kora].rate_limit` and `global_rate_limit` are **10**. The global bucket has capacity 10 and refills at 10 requests/second **per process**. Each deployed region has its own bucket; this is not a network-wide cap or payment TPS figure. The account-creation restriction plugin remains disabled for the broad-program profile.

## Verification

- Official image source/revision and startup verified; canonical configuration validated with a public deterministic fixture signer.
- Isolated real-image burst: 25 requests, 10 HTTP 200 and 15 HTTP 429. Health checks remained available; requests succeeded after refill. Startup transformation preserved all other fixture settings and rejected duplicate Kora sections.
- 15 mocked rollout/rollback scenarios passed, including missing regions, changed pricing, readiness failures and same-image rate configuration.
- Production read-only burst: 20 `getVersion` calls, 10 HTTP 200 and 10 HTTP 429. `/liveness` stayed HTTP 200. After refill, public config and signer matched the baseline except the newly exposed deny-by-default reallocation field.
- Routed unsigned quote succeeded for operator `3bc9e80416beabf8ca2cf6b95402bee2`: 10,100 lamports / 2.292367 NEIRO at test time. This is a sample quote, not a future price guarantee or a completed payment.
- Website syntax/build and 11 network tests passed. [Operator page](https://neiropay.com/operators/) and [dated image manifest](https://neiropay.com/kora-release.json) verified after publication. Cloudflare version `0e502466-f961-4e60-b163-d7fc8dcdb736`.
- The first rollout attempt restored the prior image/settings automatically after failing post-deployment checks. A subsequent attempt passed all region/image and public-state checks.

No customer signing, payment submission or operator-key access was used for these checks. No live payment settlement is claimed.

## Update workflow

The updater previously failed because current public TOML files were copied without their reviewed configuration hashes. It now reads the reviewed manifest together with those files, retains hash validation, resolves/validates the official image and runs rollout/rollback contract tests. The five-minute cron declaration is retained; actual GitHub scheduling may be delayed. Existing runtime signer/fee settings are retained on subsequent image-only upgrades.
