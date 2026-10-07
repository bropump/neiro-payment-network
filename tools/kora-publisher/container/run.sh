#!/bin/sh
# Single private publisher worker. Persist /state and run exactly one replica.
set -eu
umask 077
: "${OPERATOR:?}" "${OPERATOR_URL:?}" "${RPC_URL:?}" "${KORA_CONFIG_BASE64:?}" "${KORA_SIGNERS_BASE64:?}"
mkdir -p /tmp/publisher
printf %s "$KORA_CONFIG_BASE64" | base64 -d > /tmp/publisher/kora.toml
printf %s "$KORA_SIGNERS_BASE64" | base64 -d > /tmp/publisher/signers.toml
export SOLANA_RPC_URL="$RPC_URL"
child=
stop() { if [ -n "$child" ]; then kill "$child" 2>/dev/null || :; wait "$child" 2>/dev/null || :; fi; exit 0; }
trap stop TERM INT
while :; do
  neiro-kora-publisher --operator "$OPERATOR" --config /tmp/publisher/kora.toml \
    --signers-config /tmp/publisher/signers.toml \
    renew --url "$OPERATOR_URL" --state-dir /state &
  child=$!
  if wait "$child"; then echo 'Renewal check completed'; else echo 'Renewal check failed; retained state requires inspection if pending'; fi
  # An interval schedules checks only. Eligibility and expiry use finalized chain time.
  sleep 3600 &
  child=$!
  wait "$child" || :
done
