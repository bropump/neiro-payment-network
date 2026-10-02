# Optional remote signing

Kora already uses [solana-keychain](https://github.com/solana-foundation/solana-keychain). You select a backend in your private `signers.toml`; there is no separate keychain installation.

**For production, prefer a supported remote signer for stronger key isolation.** This is optional. The included memory signer works with a dedicated local keypair.

| Choice | What your agent sets up |
| --- | --- |
| Local keypair | Private key in the host's secret storage, supplied to Kora's memory signer |
| Remote signer, such as Para or Turnkey | Your provider wallet, private credential references and the matching Kora signer configuration |

A remote signer keeps the signing key outside the Kora host. Protect and restrict its API credentials: someone with signing access may still authorize transactions. The memory backend keeps the private key in the Kora process; solana-keychain does not make it non-exportable. Kora's transaction policies remain necessary with either choice. See the upstream [security model](https://github.com/solana-foundation/solana-keychain/blob/main/docs/SECURITY_MODEL.md).

## Ask your agent

```text
Help me choose a local or remote signer for this Kora operator.
If I choose remote signing, use a backend supported by the exact Kora
build we deploy. Configure it using secret references, validate it and
check that Kora reports the expected payer. Keep the signing key and
provider credentials out of chat, Git and router requests.
```

The agent should use [Kora's signer examples](https://github.com/solana-foundation/kora/blob/main/signers.example.toml) for the deployed revision. Backend availability in solana-keychain alone does not establish support in that Kora build. Replace the example memory entry with the chosen backend; do not accidentally leave an extra signer active. Remote signing adds provider setup, network dependency and potentially fees. Do not import or move an existing wallet unless the operator requests it.

We tested Para signing through unchanged Kora for legacy, v0 and v1 on a private ledger. That establishes compatibility for the tested build, not a security audit or a test of every provider. [Test evidence](../main-upgrade-verification.json).
