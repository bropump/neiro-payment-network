#!/bin/sh
# Same private runtime references as the existing operator; never print their values.
set -eu
mkdir -p /tmp/kora
printf %s "$KORA_CONFIG_BASE64" | base64 -d > /tmp/kora/kora.original.toml
# Preserve the existing deployed signTransaction opt-in.
sed 's/^sign_transaction[[:space:]]*=[[:space:]]*false/sign_transaction = true/' /tmp/kora/kora.original.toml > /tmp/kora/kora.methods.toml
grep -q '^sign_transaction = true' /tmp/kora/kora.methods.toml
awk '
  /^[[:space:]]*\[/ {
    metadata = ($0 ~ /^[[:space:]]*\[validation\.token_2022\][[:space:]]*(#.*)?$/)
    if (metadata) {
      if (++sections > 1) exit 42
      print
      print "allow_token_metadata_instructions = true"
      next
    }
  }
  metadata && /^[[:space:]]*allow_token_metadata_instructions[[:space:]]*=/ {
    if (++settings > 1) exit 42
    next
  }
  { print }
  END {
    if (sections == 0) {
      print "\n[validation.token_2022]"
      print "allow_token_metadata_instructions = true"
    }
  }
' /tmp/kora/kora.methods.toml > /tmp/kora/kora.toml
printf %s "$KORA_SIGNERS_BASE64" | base64 -d > /tmp/kora/signers.toml
exec kora --rpc-url "$RPC_URL" --config /tmp/kora/kora.toml rpc start --signers-config /tmp/kora/signers.toml
