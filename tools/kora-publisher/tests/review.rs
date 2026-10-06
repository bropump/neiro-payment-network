//! Independent security review: no real credentials or network requests.
use base64::{engine::general_purpose::STANDARD, Engine};
use kora_lib::{config::SplTokenConfig, Config};
use neiro_kora_publisher::{
    address, attestation_message, guard::verify_live, publish, DOMAIN, MINT, PROGRAM, SPACE,
};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_keychain::{Signer, SolanaSigner};
use solana_message::VersionedMessage;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signature},
};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};

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
struct Capture<'a> {
    calls: AtomicUsize,
    signer: &'a Signer,
    op: Pubkey,
    bytes: Mutex<Vec<u8>>,
}
#[async_trait::async_trait]
impl SolanaSigner for Capture<'_> {
    fn pubkey(&self) -> Pubkey {
        self.op
    }
    async fn is_available(&self) -> bool {
        true
    }
    async fn sign_message(&self, b: &[u8]) -> Result<Signature, solana_keychain::SignerError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if b.starts_with(DOMAIN) {
            return self.signer.sign_message(b).await;
        }
        *self.bytes.lock().unwrap() = b.to_vec();
        Ok(Signature::default())
    }
}
const GENESIS: &str = "11111111111111111111111111111111";
async fn capture(account: Value, url: Option<&str>, s: &Signer, c: &Config) -> VersionedMessage {
    let capture = Capture {
        calls: AtomicUsize::new(0),
        signer: s,
        op: s.pubkey(),
        bytes: Mutex::new(vec![]),
    };
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

#[tokio::test]
async fn legacy_marker_migration_only_writes_new_payload_without_changing_authority() {
    let (signer, config) = fixture();
    let operator = signer.pubkey();
    let mut old = record(operator);
    let mut bytes = STANDARD.decode(old["data"][0].as_str().unwrap()).unwrap();
    bytes[33..41].copy_from_slice(b"NKORAF01");
    old["data"][0] = json!(STANDARD.encode(bytes));
    let message = capture(old, Some("https://operator.example/"), &signer, &config).await;
    assert_eq!(message.instructions().len(), 1, "no create, close or authority change");
    assert_eq!(message.header().num_required_signatures, 1);
    assert_eq!(message.static_account_keys()[0], operator);
    let instruction = &message.instructions()[0];
    assert_eq!(message.static_account_keys()[instruction.program_id_index as usize], PROGRAM);
    assert_eq!(instruction.data[0], 1, "Record Write");
    assert_eq!(&instruction.data[1..9], &[0; 8], "write offset zero");
    assert_eq!(
        u32::from_le_bytes(instruction.data[9..13].try_into().unwrap()) as usize,
        SPACE - 33
    );
    assert_eq!(&instruction.data[13..21], b"NEIRO069");
    let len = u16::from_le_bytes(instruction.data[21..23].try_into().unwrap()) as usize;
    let bytes = &instruction.data[23..23 + len];
    let body: Value = serde_json::from_slice(bytes).unwrap();
    assert_eq!(body["v"], 3);
    assert_eq!(body["sig_alg"], "ed25519");
    assert_eq!(body["sig_enc"], "raw64-after-json");
    assert_eq!(body["msg_id"], "NEIRO069-MSG1");
    assert_eq!(body["signer"], operator.to_string());
    let sig = Signature::try_from(&instruction.data[23 + len..23 + len + 64]).unwrap();
    assert!(sig.verify(
        operator.as_ref(),
        &attestation_message(&address(&operator).unwrap(), GENESIS, bytes).unwrap()
    ));
    assert_eq!(body["operator"], operator.to_string());
    assert_eq!(body["price"], serde_json::to_value(&config.validation.price).unwrap());
    let keys: Vec<_> =
        instruction.accounts.iter().map(|i| message.static_account_keys()[*i as usize]).collect();
    assert_eq!(keys, vec![address(&operator).unwrap(), operator]);
    // Optional public-only interoperability fixture, never real keys.
    if let Ok(path) = std::env::var("NEIRO_PUBLIC_FIXTURE_OUT") {
        let mut account_bytes = vec![1];
        account_bytes.extend_from_slice(operator.as_ref());
        account_bytes.extend_from_slice(&instruction.data[13..]);
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"record":address(&operator).unwrap().to_string(),"genesis":GENESIS,"account":{"owner":PROGRAM.to_string(),"executable":false,"data":[STANDARD.encode(account_bytes),"base64"]}})).unwrap()).unwrap();
    }
}

#[tokio::test]
async fn unchanged_valid_attestation_needs_no_signing_or_transaction() {
    let (s, c) = fixture();
    let op = s.pubkey();
    let message = capture(record(op), Some("https://operator.example/"), &s, &c).await;
    let mut data = vec![1];
    data.extend_from_slice(op.as_ref());
    data.extend_from_slice(&message.instructions()[0].data[13..]);
    let a = json!({"owner":PROGRAM.to_string(),"lamports":4_373_880,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(data),"base64"]});
    let rpc = RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (RpcRequest::GetGenesisHash, json!(GENESIS)),
            (RpcRequest::GetAccountInfo, json!({"context":{"slot":1},"value":a})),
        ]),
    );
    let recorder =
        Capture { calls: AtomicUsize::new(0), signer: &s, op, bytes: Mutex::new(vec![]) };
    let dir = tempfile::tempdir().unwrap();
    let journal = dir.path().join("j");
    assert!(publish(&rpc, &c, &recorder, op, Some("https://operator.example/"), GENESIS, &journal)
        .await
        .unwrap()
        .is_none());
    assert_eq!(recorder.calls.load(Ordering::SeqCst), 0);
    assert!(recorder.bytes.lock().unwrap().is_empty());
    assert!(!journal.exists());
}

#[tokio::test]
async fn attestation_is_bound_to_record_chain_and_exact_bytes() {
    let (s, _) = fixture();
    let record = address(&s.pubkey()).unwrap();
    let body = b"{\"v\":2}";
    let bytes = attestation_message(&record, GENESIS, body).unwrap();
    let sig = s.sign_message(&bytes).await.unwrap();
    assert!(sig.verify(s.pubkey().as_ref(), &bytes));
    for changed in [
        attestation_message(&Pubkey::new_unique(), GENESIS, body).unwrap(),
        attestation_message(&record, &Pubkey::new_unique().to_string(), body).unwrap(),
        attestation_message(&record, GENESIS, b"{\"v\":1}").unwrap(),
    ] {
        assert!(!sig.verify(s.pubkey().as_ref(), &changed));
    }
    assert!(
        bincode::deserialize::<VersionedMessage>(&bytes).is_err(),
        "attestation is not a transaction message"
    );
}

#[tokio::test]
async fn signed_v2_migrates_in_place_to_the_same_format_as_new_records() {
    let (s, c) = fixture();
    let op = s.pubkey();
    let rec = address(&op).unwrap();
    let fresh = capture(Value::Null, Some("https://operator.example/"), &s, &c).await;
    let write = fresh.instructions().last().unwrap();
    let len = u16::from_le_bytes(write.data[21..23].try_into().unwrap()) as usize;
    let mut body: Value = serde_json::from_slice(&write.data[23..23 + len]).unwrap();
    for field in ["sig_alg", "sig_enc", "msg_id", "signer"] {
        body.as_object_mut().unwrap().remove(field);
    }
    body["v"] = json!(2);
    let raw = serde_json::to_vec(&body).unwrap();
    let chain: Pubkey = GENESIS.parse().unwrap();
    let message = [
        b"\xffNEIRO069:listing:v2\0".as_slice(),
        PROGRAM.as_ref(),
        rec.as_ref(),
        chain.as_ref(),
        &raw,
    ]
    .concat();
    let proof = s.sign_message(&message).await.unwrap();
    let mut data = vec![1];
    data.extend_from_slice(op.as_ref());
    data.extend_from_slice(b"NEIRO069");
    data.extend_from_slice(&(raw.len() as u16).to_le_bytes());
    data.extend_from_slice(&raw);
    data.extend_from_slice(proof.as_ref());
    data.resize(SPACE, 0);
    let old = json!({"owner":PROGRAM.to_string(),"lamports":4_373_880,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(data),"base64"]});
    let migrated = capture(old, Some("https://operator.example/"), &s, &c).await;
    assert_eq!(migrated.instructions().len(), 1, "migration only writes");
    assert_eq!(
        migrated.instructions()[0].data,
        write.data,
        "create and migration publish identical metadata and proof"
    );
}
