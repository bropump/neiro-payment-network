# Join or leave the Cloudflare router

Run Kora at a stable public HTTPS URL. Enable `get_config`, `get_payer_signer` and `estimate_transaction_fee`, accept NEIRO for reimbursement, and choose the signing methods you offer.

```sh
export ROUTER_URL=https://neiro-cf-router-demo.optical.workers.dev
curl "$ROUTER_URL/operators/register" \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://YOUR-OPERATOR/rpc"}'
```

Host the returned `verification` JSON at the returned `verificationUrl`. Then verify using the returned ID:

```sh
curl "$ROUTER_URL/operators/verify" \
  -H 'Content-Type: application/json' \
  --data '{"id":"REGISTRATION_ID"}'
```

Keep the proof file available. It proves HTTPS endpoint control; it is public and contains no wallet key. The router checks identity/configuration and periodically refreshes availability and sample fees. Pending registrations expire after 15 minutes; complete verification or register again.

Check `GET /operators` for eligibility. Pin your operator when testing a quote. Eligibility is not a guarantee that every transaction will pass Kora policy or that the wallet can fund it.

## Leave

Change the hosted proof to `enabled:false`, then request removal:

```sh
curl "$ROUTER_URL/operators/remove" \
  -H 'Content-Type: application/json' \
  --data '{"id":"REGISTRATION_ID"}'
```

The router reads the hosted proof before removal. Cached entries can take time to disappear. Deployment-configured test operators are removed through the router's configuration instead.

No registration transaction, wallet signature or renewal payment is needed. Older on-chain registry scripts in this repository do not join this Cloudflare network.
