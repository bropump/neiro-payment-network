# Connect Kora to the router

You need a running public HTTPS Kora endpoint and control of that hostname's web routing. Your wallet key stays with Kora. Registration uses HTTP; there is no registration transaction or periodic renewal.

## Register

Set `KORA_ENDPOINT` to your real Kora HTTPS URL. The commands below use `curl` and `jq`:

```sh
export NEIRO_ROUTER_URL='https://api.mainnet-beta.neiropay.app'
export KORA_ENDPOINT='https://kora.your-domain.com'

jq -n --arg url "$KORA_ENDPOINT" '{url:$url}' |
  curl --fail-with-body --silent --show-error \
    "$NEIRO_ROUTER_URL/operators/register" \
    -H 'content-type: application/json' --data-binary @- > registration.json

jq '{id, status, verificationUrl, verification}' registration.json
jq '.verification' registration.json > verification.json
export OPERATOR_ID="$(jq -r '.id' registration.json)"
```

Serve `verification.json` at the exact `verificationUrl` returned, such as `https://kora.your-domain.com/.well-known/neiro-router/ID`. Configure your HTTPS host to serve that path as JSON while sending Kora requests to Kora. This is a static file, not a Kora config field. It contains a token and `enabled: true`; it contains no wallet key.

Keep the file available. Complete initial verification within 15 minutes; if the pending record expires, register again and use the newly returned proof. The Kora endpoint must use HTTPS without URL credentials, an explicit port, query, fragment or redirects.

## Verify and check

```sh
jq -n --arg id "$OPERATOR_ID" '{id:$id}' |
  curl --fail-with-body --silent --show-error \
    "$NEIRO_ROUTER_URL/operators/verify" \
    -H 'content-type: application/json' --data-binary @-

curl --fail --silent --show-error "$NEIRO_ROUTER_URL/operators" |
  jq --arg id "$OPERATOR_ID" '.operators[] | select(.id == $id)'
```

Look for `status: "active"` in the verify response and `eligible: true` in the operator listing. Verification checks the hosted proof, Kora payer identity, required methods and NEIRO payment support. Background checks also sample unsigned quotes. This does not certify every transaction or the provider's exact software build. There is no dollar-denominated wallet-balance admission check; you still need enough SOL to sponsor your workload.

The router allows one verification attempt per registration per 60 seconds. Cached routing views can take up to approximately 120 seconds to reflect changes. Obtain a quote for your intended transaction through `/rpc?operator=YOUR_OPERATOR_ID` and keep that operator pinned through signing and submission.

## Check through the router

With the registration variables above, check your pinned Kora identity:

```sh
curl --fail-with-body --silent --show-error \
  "$NEIRO_ROUTER_URL/rpc?operator=$OPERATOR_ID" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getPayerSigner","params":{}}'
```

Expect your operator's public payer in `result.signer_address`. Have your agent use [Kora's API/SDK](https://solana.com/docs/tools/kora) to prepare an unsigned transaction with that payer and request `estimateTransactionFee` through the same pinned URL. Check the returned payer, payment address and NEIRO fee. Quoting does not sign, submit or spend funds; a successful quote is not a settled payment.

## After an upgrade or config change

Validate your config, restart Kora, then repeat the verify and listing commands with your saved `OPERATOR_ID`. No new registration is needed while the endpoint and payer/payment identity stay the same. The router does not install or upgrade Kora for you, and currently does not reject operators merely for running an older version.

If verification fails, check that the proof URL returns the unchanged token with `enabled: true`, that Kora is reachable publicly, and that its config supports NEIRO. A 429 may indicate the verification cooldown or a request limit. Background checks continue, but successful verification does not instantly invalidate every routing cache.

## Change identity or leave

For a new endpoint or payer/payment identity, remove the old registration and register the new endpoint. To remove your registration, first serve the same proof token with `enabled: false`, then call:

```sh
jq -n --arg id "$OPERATOR_ID" '{id:$id}' |
  curl --fail-with-body --silent --show-error \
    "$NEIRO_ROUTER_URL/operators/remove" \
    -H 'content-type: application/json' --data-binary @-
```

Check `/operators` after cache refresh. Operators configured directly in a router deployment must be removed from that deployment's settings instead.
