# Agent setup

Ask where the user wants to host, what fee to charge and the maximum SOL to sponsor per transaction. Reuse answers already supplied. Explain margin, fixed and free pricing briefly; template values are examples.

1. Read JOIN.md and REGISTRATION.md. Obtain the private signer reference, RPC and Jupiter credential references, intended public operator hostname and chosen network settings. Obtain access to the reviewed Rust CLI source separately; no download URL is published here yet.
2. Install the pinned official Kora version, using an upstream source build or official image for the host. Copy the templates to private storage. Set the chosen pricing and allowance without relaxing sponsor permissions.
3. Prepare the payer's SOL and canonical NEIRO token account. Admission requires at least $1 of each, even for free sponsors. Keep enough additional SOL for the intended workload and registry fees.
4. Validate Kora and arrange HTTPS plus service restart/monitoring. The public router does not send a provider API key. Before exposing a fresh public endpoint, verify Kora policy and request limits. Do not weaken an existing authenticated deployment automatically.
5. Use the Rust CLI locally on the operator-owned host to publish the registration within the user's spending authorization. Record the transaction signature, expiry and revision. No sponsor key goes to a router.
6. Confirm finalized publication and CLI discovery. Check the selected router's /readyz and /operators, then get an unsigned quote pinned to the payer at /rpc?provider=PAYER. Discovery alone does not mean admitted or payment-tested.
7. Arrange a single renewal job before expiry, with a persisted increasing revision, bounded fees and failure alerts. Reconcile timeouts rather than blindly publishing again. Test a full payment on a private ledger, or live only within authorized spending.
8. Leave private config locations, chosen settings, start/stop/restart commands, renewal status and outstanding inputs. A missing CLI source or network setting is an explicit setup dependency, not a reason to invent one.

Hosting a router is optional and separate. See ROUTER.md.
