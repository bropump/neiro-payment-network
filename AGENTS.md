# Set up NEIRO operators

Use docs/OPERATOR-SETUP.md as the single installation guide (linked from README.md) and docs/AGENT-SETUP.md as its verification checklist. Keep official Kora and its SDK unchanged. The listing runner uses Node24+ with locked dependencies and no operator compilation.

Before installation, fetch the current NPN guide and resolve official Kora upstream main. Always install that main revision, never a crates.io/stable release or a test report's old digest. Use the guide's exact container/native commands and verify the deployed source SHA. Install a host update check every five minutes; an old pin or failed rollout must be reported as out of date. The listing runner does not upgrade Kora.

Carry a new operator from zero through all five operator setup steps and finish checks, including installing Kora, selecting signing custody, funding, preparing the NEIRO receipt account and exposing HTTPS. Reuse the user's host, signer, fees and permissions. Install the runner; run protect against the actual private Kora config; restart every instance sharing that key; verify loaded and enforced listing protection; then install one supervised renew --watch service with private persistent state. That command publishes and renews: do not add a separate daily job. Verify finalized publication and direct RPC discovery, service restart/persistent state, and a direct payment within authorized limits. If a required check cannot run, report the setup incomplete. Ask only for missing inputs; never expose credentials or remove the user's signer/recovery access.

Keep one worker per signer, preserve receipts/state and stop it before closure or replacement. See docs/RENEWAL.md for updates and crash recovery. Do not discard an unresolved journal to retry. Respect payment-test authorization and preserve existing accounts; leave operational listings open unless retirement or temporary-test cleanup was requested.

Finish with a short operating note containing exact host commands and verified results. Commit changes only as bropump.
