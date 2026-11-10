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
# Set only the approved request limits; retain private signer/RPC/fee settings.
awk '
  /^[[:space:]]*\[/ {
    in_kora = ($0 ~ /^[[:space:]]*\[kora\][[:space:]]*(#.*)?$/)
    if (in_kora) {
      if (++sections > 1) exit 42
      print
      print "rate_limit = 10"
      print "global_rate_limit = 10"
      next
    }
  }
  in_kora && /^[[:space:]]*rate_limit[[:space:]]*=/ {
    if (++rates > 1) exit 42
    next
  }
  in_kora && /^[[:space:]]*global_rate_limit[[:space:]]*=/ {
    if (++globals > 1) exit 42
    next
  }
  { print }
  END { if (sections != 1) exit 42 }
' /tmp/kora/kora.toml > /tmp/kora/kora.limited.toml
mv /tmp/kora/kora.limited.toml /tmp/kora/kora.toml
printf %s "$KORA_SIGNERS_BASE64" | base64 -d > /tmp/kora/signers.toml
exec kora --rpc-url "$RPC_URL" --config /tmp/kora/kora.toml rpc start --signers-config /tmp/kora/signers.toml
