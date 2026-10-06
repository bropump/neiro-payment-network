//! Independent security review: no real credentials or network requests.
use base64::{engine::general_purpose::STANDARD, Engine};
use kora_lib::{config::SplTokenConfig, Config};
use neiro_kora_publisher::{address, guard::verify_live, publish, MINT, PROGRAM, SPACE};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_keychain::{Signer, SolanaSigner};
use solana_message::VersionedMessage;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signature},
};
use std::{collections::HashMap, sync::Mutex};

fn fixture() -> (Signer, Config) {
    let s = Signer::from_memory(&Keypair::new().to_base58_string()).unwrap();
    let mut c =
        Config::load_config(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/kora.fixture.toml"))
            .unwrap();
    c.validation.disallowed_accounts = vec![address(&s.pubkey()).unwrap().to_string()];
    c.validation.allowed_tokens = vec![MINT.into()];
    c.validation.allowed_spl_paid_tokens = SplTokenConfig::Allowlist(vec![MINT.into()]);
    (s, c)
}
fn responses(c: &Config, op: Pubkey) -> (Value, Value) {
    (
        json!({"fee_payers":[op.to_string()],"validation_config":c.validation}),
        json!({"signer_address":op.to_string(),"payment_address":c.kora.get_payment_address(&op).unwrap().to_string()}),
    )
}
#[test]
fn live_guard_rejects_each_advertised_term_mismatch() {
    let (s, c) = fixture();
    let op = s.pubkey();
    let (live, payer) = responses(&c, op);
    verify_live(&c, op, &live, &payer).unwrap();
    for field in [
        "disallowed_accounts",
        "price",
        "price_source",
        "allowed_tokens",
        "allowed_spl_paid_tokens",
    ] {
        let mut changed = live.clone();
        changed["validation_config"][field] = Value::Null;
        assert!(verify_live(&c, op, &changed, &payer).is_err(), "missing {field}");
    }
    for field in ["signer_address", "payment_address"] {
        let mut changed = payer.clone();
        changed[field] = json!(Pubkey::new_unique().to_string());
        assert!(verify_live(&c, op, &live, &changed).is_err(), "wrong {field}");
    }
    let mut changed = live.clone();
    changed["fee_payers"] = json!([Pubkey::new_unique().to_string()]);
    assert!(verify_live(&c, op, &changed, &payer).is_err());
    changed = live.clone();
    changed["validation_config"]["allowed_spl_paid_tokens"] = json!([]);
    assert!(verify_live(&c, op, &changed, &payer).is_err());
    changed = live.clone();
    changed["validation_config"]["disallowed_accounts"] = json!([PROGRAM.to_string()]);
    assert!(
        verify_live(&c, op, &changed, &payer).is_err(),
        "publisher requires exact listing deny"
    );
}
#[test]
fn payment_override_and_paid_all_are_matched_explicitly() {
    let (s, mut c) = fixture();
    let op = s.pubkey();
    c.kora.payment_address = Some(Pubkey::new_unique().to_string());
    let (mut live, mut payer) = responses(&c, op);
    live["validation_config"]["allowed_spl_paid_tokens"] = json!("All");
    verify_live(&c, op, &live, &payer).unwrap();
    payer["payment_address"] = json!(op.to_string());
    assert!(verify_live(&c, op, &live, &payer).is_err());
}
struct Capture {
    op: Pubkey,
    bytes: Mutex<Vec<u8>>,
}
#[async_trait::async_trait]
impl SolanaSigner for Capture {
    fn pubkey(&self) -> Pubkey {
        self.op
    }
    async fn is_available(&self) -> bool {
        true
    }
    async fn sign_message(&self, b: &[u8]) -> Result<Signature, solana_keychain::SignerError> {
        *self.bytes.lock().unwrap() = b.to_vec();
        Ok(Signature::default())
    }
}
const GENESIS: &str = "11111111111111111111111111111111";
async fn capture(account: Value, url: Option<&str>, s: &Signer, c: &Config) -> VersionedMessage {
    let capture = Capture { op: s.pubkey(), bytes: Mutex::new(vec![]) };
    let rpc = RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (RpcRequest::GetGenesisHash, json!(GENESIS)),
            (RpcRequest::GetAccountInfo, json!({"context":{"slot":1},"value":account})),
            (RpcRequest::GetMinimumBalanceForRentExemption, json!(4_373_880)),
            (RpcRequest::GetFeeForMessage, json!({"context":{"slot":1},"value":5000})),
        ]),
    );
    let dir = tempfile::tempdir().unwrap();
    let journal = dir.path().join("journal");
    let err = publish(&rpc, c, &capture, s.pubkey(), url, GENESIS, &journal).await.unwrap_err();
    assert!(err.to_string().contains("invalid backend signature"), "{err}");
    assert!(!journal.exists());
    let bytes = capture.bytes.lock().unwrap();
    bincode::deserialize(&bytes).unwrap()
}
fn record(op: Pubkey) -> Value {
    let mut bytes = vec![0; SPACE];
    bytes[0] = 1;
    bytes[1..33].copy_from_slice(op.as_ref());
    json!({"owner":PROGRAM.to_string(),"lamports":4_373_880,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(bytes),"base64"]})
}
#[tokio::test]
async fn prefunding_recovery_and_creation_share_one_operator_signed_message() {
    let (s, c) = fixture();
    let op = s.pubkey();
    let rec = address(&op).unwrap();
    let a = json!({"owner":solana_system_interface::program::ID.to_string(),"lamports":123,"executable":false,"rentEpoch":0,"data":["","base64"]});
    let m = capture(a, Some("https://operator.example/"), &s, &c).await;
    assert_eq!(m.header().num_required_signatures, 1);
    assert_eq!(m.static_account_keys()[0], op);
    let ix = m.instructions();
    assert_eq!(ix.len(), 4);
    assert_eq!(
        m.static_account_keys()[ix[0].program_id_index as usize],
        solana_system_interface::program::ID
    );
    assert_eq!(m.static_account_keys()[ix[0].accounts[0] as usize], rec);
    assert_eq!(m.static_account_keys()[ix[0].accounts[2] as usize], op);
    assert_eq!(
        m.static_account_keys()[ix[1].program_id_index as usize],
        solana_system_interface::program::ID
    );
    assert_eq!(m.static_account_keys()[ix[2].program_id_index as usize], PROGRAM);
    assert_eq!(m.static_account_keys()[ix[3].program_id_index as usize], PROGRAM);
}
#[tokio::test]
async fn close_returns_rent_only_to_operator_and_update_only_writes_record() {
    let (s, c) = fixture();
    let op = s.pubkey();
    let rec = address(&op).unwrap();
    let close = capture(record(op), None, &s, &c).await;
    let ix = &close.instructions()[0];
    assert_eq!(close.instructions().len(), 1);
    assert_eq!(close.static_account_keys()[ix.program_id_index as usize], PROGRAM);
    let keys: Vec<_> =
        ix.accounts.iter().map(|i| close.static_account_keys()[*i as usize]).collect();
    assert!(keys.iter().all(|k| *k == op || *k == rec));
    assert_eq!(keys[0], rec);
    assert_eq!(keys[1], op);
    assert_eq!(keys[2], op);
    let update = capture(record(op), Some("https://operator.example/"), &s, &c).await;
    assert_eq!(update.instructions().len(), 1);
    assert_eq!(update.header().num_required_signatures, 1);
    let ix = &update.instructions()[0];
    assert_eq!(update.static_account_keys()[ix.program_id_index as usize], PROGRAM);
    assert_eq!(update.static_account_keys()[ix.accounts[0] as usize], rec);
}
