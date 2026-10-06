use base64::{engine::general_purpose::STANDARD, Engine};
use kora_lib::{config::SplTokenConfig, Config};
use neiro_kora_publisher::{address, publish, MINT, PROGRAM, SPACE};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_keychain::{Signer, SolanaSigner};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signature},
};
use std::{
    collections::HashMap,
    sync::atomic::{AtomicUsize, Ordering},
};

struct CountingSigner {
    inner: Signer,
    calls: AtomicUsize,
    corrupt: bool,
}
#[async_trait::async_trait]
impl SolanaSigner for CountingSigner {
    fn pubkey(&self) -> Pubkey {
        self.inner.pubkey()
    }
    async fn is_available(&self) -> bool {
        true
    }
    async fn sign_message(&self, bytes: &[u8]) -> Result<Signature, solana_keychain::SignerError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if self.corrupt {
            Ok(Signature::default())
        } else {
            self.inner.sign_message(bytes).await
        }
    }
}
fn setup() -> (CountingSigner, Config) {
    let s = CountingSigner {
        inner: Signer::from_memory(&Keypair::new().to_base58_string()).unwrap(),
        calls: AtomicUsize::new(0),
        corrupt: false,
    };
    let mut c =
        Config::load_config(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/kora.fixture.toml"))
            .unwrap();
    c.validation.disallowed_accounts = vec![address(&s.pubkey()).unwrap().to_string()];
    c.validation.allowed_tokens = vec![MINT.into()];
    c.validation.allowed_spl_paid_tokens = SplTokenConfig::Allowlist(vec![MINT.into()]);
    (s, c)
}
const GENESIS: &str = "11111111111111111111111111111111";
fn rpc(account: Value, rent: u64, fee: u64) -> RpcClient {
    RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (RpcRequest::GetGenesisHash, json!(GENESIS)),
            (RpcRequest::GetAccountInfo, json!({"context":{"slot":1},"value":account})),
            (RpcRequest::GetMinimumBalanceForRentExemption, json!(rent)),
            (RpcRequest::GetFeeForMessage, json!({"context":{"slot":1},"value":fee})),
        ]),
    )
}
fn account(op: Pubkey) -> Value {
    let mut bytes = vec![0; SPACE];
    bytes[0] = 1;
    bytes[1..33].copy_from_slice(op.as_ref());
    json!({"owner":PROGRAM.to_string(),"lamports":4_373_880,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(bytes),"base64"]})
}
#[tokio::test]
async fn invalid_urls_never_sign() {
    let (s, c) = setup();
    let dir = tempfile::tempdir().unwrap();
    for url in [
        "http://127.0.0.1:18080/",
        "http://operator.example/",
        "https://u:p@operator.example/",
        "https://operator.example/?secret=1",
        "https://operator.example/#secret",
        "bad",
    ] {
        let r = publish(
            &rpc(Value::Null, 1, 5000),
            &c,
            &s,
            s.pubkey(),
            Some(url),
            GENESIS,
            &dir.path().join("j"),
        )
        .await;
        assert!(r.is_err(), "{url}");
    }
    assert_eq!(s.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test]
async fn identity_network_and_guard_checked_before_signing() {
    let (s, mut c) = setup();
    let dir = tempfile::tempdir().unwrap();
    let j = dir.path().join("j");
    assert!(publish(
        &rpc(Value::Null, 1, 5000),
        &c,
        &s,
        Pubkey::new_unique(),
        Some("https://example.com/"),
        GENESIS,
        &j
    )
    .await
    .unwrap_err()
    .to_string()
    .contains("signer mismatch"));
    assert!(publish(&rpc(Value::Null, 1, 5000), &c, &s, s.pubkey(), None, "wrong-chain", &j)
        .await
        .unwrap_err()
        .to_string()
        .contains("wrong RPC network"));
    c.validation.disallowed_accounts.clear();
    assert!(publish(
        &rpc(Value::Null, 1, 5000),
        &c,
        &s,
        s.pubkey(),
        Some("https://example.com/"),
        GENESIS,
        &j
    )
    .await
    .unwrap_err()
    .to_string()
    .contains("deny"));
    // Closing an absent account works without the old guard; recovery cannot depend on a live Kora.
    assert!(publish(&rpc(Value::Null, 1, 5000), &c, &s, s.pubkey(), None, GENESIS, &j)
        .await
        .unwrap()
        .is_none());
    assert_eq!(s.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test]
async fn malformed_foreign_record_never_signs() {
    let (s, c) = setup();
    let dir = tempfile::tempdir().unwrap();
    for bad in 0..5 {
        let mut a = account(s.pubkey());
        match bad {
            0 => a["owner"] = json!(Pubkey::new_unique().to_string()),
            1 => a["executable"] = json!(true),
            2 => a["data"][0] = json!(STANDARD.encode([1; 32])),
            3 => a = account(Pubkey::new_unique()),
            _ => {
                let mut d = vec![0; SPACE];
                d[1..33].copy_from_slice(s.pubkey().as_ref());
                a["data"][0] = json!(STANDARD.encode(d));
            }
        }
        assert!(publish(
            &rpc(a, 1, 5000),
            &c,
            &s,
            s.pubkey(),
            None,
            GENESIS,
            &dir.path().join("j")
        )
        .await
        .is_err());
    }
    assert_eq!(s.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test]
async fn caps_mint_and_payload_stop_before_signing() {
    let (s, mut c) = setup();
    let dir = tempfile::tempdir().unwrap();
    let j = dir.path().join("j");
    for (rent, fee, expected) in [(7_000_001, 5000, "rent cap"), (1, 10_001, "fee cap")] {
        let e = publish(
            &rpc(Value::Null, rent, fee),
            &c,
            &s,
            s.pubkey(),
            Some("https://example.com/"),
            GENESIS,
            &j,
        )
        .await
        .unwrap_err();
        assert!(e.to_string().contains(expected), "{e}");
    }
    let long = format!("https://example.com/{}", "a".repeat(1000));
    assert!(publish(&rpc(Value::Null, 1, 5000), &c, &s, s.pubkey(), Some(&long), GENESIS, &j)
        .await
        .unwrap_err()
        .to_string()
        .contains("too large"));
    c.validation.allowed_spl_paid_tokens = SplTokenConfig::Allowlist(vec![]);
    assert!(publish(
        &rpc(Value::Null, 1, 5000),
        &c,
        &s,
        s.pubkey(),
        Some("https://example.com/"),
        GENESIS,
        &j
    )
    .await
    .unwrap_err()
    .to_string()
    .contains("NEIRO"));
    assert_eq!(s.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test]
async fn invalid_backend_signature_is_not_sent_or_journaled() {
    let (mut s, c) = setup();
    s.corrupt = true;
    let dir = tempfile::tempdir().unwrap();
    let j = dir.path().join("j");
    let e = publish(&rpc(account(s.pubkey()), 1, 5000), &c, &s, s.pubkey(), None, GENESIS, &j)
        .await
        .unwrap_err();
    assert!(e.to_string().contains("invalid backend signature"), "{e}");
    assert_eq!(s.calls.load(Ordering::SeqCst), 1);
    assert!(!j.exists());
}
#[tokio::test]
async fn journal_cannot_be_overwritten() {
    let (s, c) = setup();
    let dir = tempfile::tempdir().unwrap();
    let j = dir.path().join("j");
    std::fs::write(&j, "prior transaction").unwrap();
    assert!(publish(&rpc(account(s.pubkey()), 1, 5000), &c, &s, s.pubkey(), None, GENESIS, &j)
        .await
        .is_err());
    assert_eq!(std::fs::read_to_string(j).unwrap(), "prior transaction");
}
