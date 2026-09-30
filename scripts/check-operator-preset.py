"""CI check for the documented payment preset; Python 3.11+, no packages."""
from pathlib import Path
import hashlib
import json
import re
import tomllib

root = Path(__file__).resolve().parent.parent
base = root / "examples" / "operator"
lock = json.loads((base / "kora-release.json").read_text())
assert re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?", lock["version"])
assert lock["tag"] == "v" + lock["version"]
assert re.fullmatch(r"ghcr\.io/solana-foundation/kora@sha256:[0-9a-f]{64}", lock["image"])
assert set(lock["config_sha256"]) == {"kora.toml", "signers.toml"}, "Both reviewed TOML hashes are required"
for name, expected in lock["config_sha256"].items():
    assert name in {"kora.toml", "signers.toml"}
    assert re.fullmatch(r"[0-9a-f]{64}", expected), "Invalid reviewed config hash"
    assert hashlib.sha256((base / name).read_bytes()).hexdigest() == expected, name + " differs from the reviewed configuration"

config = tomllib.loads((base / "kora.toml").read_text())
signers = tomllib.loads((base / "signers.toml").read_text())
v = config["validation"]
neiro = "CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump"
assert v["allowed_tokens"] == [neiro]
assert v["allowed_spl_paid_tokens"] == [neiro]
assert v["price_source"] == "Jupiter"
assert v["price"] == {"type": "margin", "margin": 0.5}
assert v["max_allowed_lamports"] == 10_000_000
assert v["max_signatures"] == 4
assert set(v["allowed_programs"]) == {
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "AddressLookupTab1e1111111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
}
policy = v["fee_payer_policy"]
assert policy["system"]["allow_create_account"] is True
assert all(value is False for name, value in policy["system"].items() if name not in {"allow_create_account", "nonce"})
assert all(value is False for value in policy["system"]["nonce"].values())
for kind in ["spl_token", "token_2022", "alt"]:
    assert all(value is False for value in policy[kind].values())
methods = config["kora"]["enabled_methods"]
for method in ["estimate_transaction_fee", "sign_and_send_transaction", "get_config", "get_payer_signer", "get_blockhash"]:
    assert methods[method] is True
assert methods["sign_transaction"] is False
assert signers["signers"] == [{"name": "neiro-provider", "type": "memory", "private_key_env": "KORA_PRIVATE_KEY"}]
assert signers["signer_pool"]["strategy"] == "round_robin"
print("PASS: reviewed NEIRO payment defaults, signer template and official release lock")
