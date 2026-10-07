//! Independent renewal safety review; all RPC responses are mocked.
use neiro_kora_publisher::{
    address, attestation_message,
    renewal::{self, Anchor},
    MAGIC, SPACE,
};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_keychain::{Signer, SolanaSigner};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signature},
};
use std::collections::HashMap;
const GENESIS: &str = "11111111111111111111111111111111";
fn mock(status: Value) -> RpcClient {
    RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (RpcRequest::GetGenesisHash, json!(GENESIS)),
            (RpcRequest::GetSignatureStatuses, json!({"context":{"slot":100},"value":[status]})),
            (RpcRequest::GetBlock, json!({"blockhash":GENESIS,"blockTime":1000})),
        ]),
    )
}
fn receipt(dir: &std::path::Path, record: &Pubkey) -> String {
    let signature = Signature::from([1; 64]).to_string();
    std::fs::write(
        dir.join("pending.json"),
        serde_json::to_vec(
            &json!({"record":record.to_string(),"genesis":GENESIS,"signature":signature}),
        )
        .unwrap(),
    )
    .unwrap();
    signature
}
#[test]
fn os_lock_excludes_overlap_and_releases_on_drop() {
    let dir = tempfile::tempdir().unwrap();
    let first = renewal::lock_state(dir.path()).unwrap();
    assert!(renewal::lock_state(dir.path()).is_err());
    drop(first);
    assert!(renewal::lock_state(dir.path()).is_ok());
}
#[tokio::test]
async fn unknown_nonfinal_and_failed_receipts_cannot_be_cleared() {
    for status in [
        Value::Null,
        json!({"slot":99,"confirmations":1,"err":null,"status":{"Ok":null},"confirmationStatus":"confirmed"}),
        json!({"slot":99,"confirmations":null,"err":{"InstructionError":[0,"InvalidArgument"]},"status":{"Err":{"InstructionError":[0,"InvalidArgument"]}},"confirmationStatus":"finalized"}),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let record = Pubkey::new_unique();
        let sig = receipt(dir.path(), &record);
        let before = std::fs::read(dir.path().join("pending.json")).unwrap();
        assert!(renewal::reconcile(&mock(status), dir.path(), &record, GENESIS).await.is_err());
        assert_eq!(std::fs::read(dir.path().join("pending.json")).unwrap(), before);
        assert!(!dir.path().join(format!("{sig}.json")).exists());
    }
}
fn finalized() -> Value {
    json!({"slot":99,"confirmations":null,"err":null,"status":{"Ok":null},"confirmationStatus":"finalized"})
}
#[tokio::test]
async fn successful_receipt_archive_is_durable_and_restart_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let record = Pubkey::new_unique();
    let sig = receipt(dir.path(), &record);
    let before = std::fs::read(dir.path().join("pending.json")).unwrap();
    let archive = dir.path().join(format!("{sig}.json"));
    // Model crash after archive link, before pending removal.
    std::fs::hard_link(dir.path().join("pending.json"), &archive).unwrap();
    renewal::reconcile(&mock(finalized()), dir.path(), &record, GENESIS).await.unwrap();
    assert!(!dir.path().join("pending.json").exists());
    assert_eq!(std::fs::read(archive).unwrap(), before);
    renewal::reconcile(&mock(Value::Null), dir.path(), &record, GENESIS).await.unwrap();
}
#[tokio::test]
async fn wrong_receipt_identity_or_conflicting_archive_stops_reconciliation() {
    let dir = tempfile::tempdir().unwrap();
    let record = Pubkey::new_unique();
    let sig = receipt(dir.path(), &record);
    assert!(renewal::reconcile(&mock(finalized()), dir.path(), &Pubkey::new_unique(), GENESIS)
        .await
        .is_err());
    assert!(renewal::reconcile(
        &mock(finalized()),
        dir.path(),
        &record,
        &Pubkey::new_unique().to_string()
    )
    .await
    .is_err());
    std::fs::write(dir.path().join(format!("{sig}.json")), b"conflict").unwrap();
    assert!(renewal::reconcile(&mock(finalized()), dir.path(), &record, GENESIS).await.is_err());
    assert!(dir.path().join("pending.json").exists());
}
async fn listing(signer: &Signer, mut terms: Value, slot: u64, hash: &str) -> Vec<u8> {
    terms["anchor_slot"] = json!(slot);
    terms["anchor_blockhash"] = json!(hash);
    let raw = serde_json::to_vec(&terms).unwrap();
    let op = signer.pubkey();
    let record = address(&op).unwrap();
    let sig =
        signer.sign_message(&attestation_message(&record, GENESIS, &raw).unwrap()).await.unwrap();
    let mut bytes = vec![1];
    bytes.extend_from_slice(op.as_ref());
    bytes.extend_from_slice(MAGIC);
    bytes.extend_from_slice(&(raw.len() as u16).to_le_bytes());
    bytes.extend_from_slice(&raw);
    bytes.extend_from_slice(sig.as_ref());
    bytes.resize(SPACE, 0);
    bytes
}
#[tokio::test]
async fn daily_boundary_and_changed_terms_use_authenticated_chain_anchor() {
    let signer = Signer::from_memory(&Keypair::new().to_base58_string()).unwrap();
    let op = signer.pubkey();
    let record = address(&op).unwrap();
    let wanted = json!({"v":5,"url":"https://example.com/","operator":op.to_string(),"payment":op.to_string(),"mint":"m","genesis":GENESIS,"price":{"type":"free"},"oracle":"Jupiter"});
    let bytes = listing(&signer, wanted.clone(), 99, GENESIS).await;
    for (age, fresh) in [(0, true), (86399, true), (86400, false), (172800, false)] {
        let now = Anchor { slot: 100, hash: GENESIS.into(), time: 1000 + age };
        assert_eq!(
            renewal::unchanged_and_fresh(
                &mock(Value::Null),
                &bytes,
                &record,
                &op,
                GENESIS,
                &wanted,
                &now
            )
            .await
            .unwrap(),
            fresh
        );
    }
    let now = Anchor { slot: 100, hash: GENESIS.into(), time: 1000 };
    let mut changed = wanted.clone();
    changed["url"] = json!("https://changed.example/");
    assert!(!renewal::unchanged_and_fresh(
        &mock(Value::Null),
        &bytes,
        &record,
        &op,
        GENESIS,
        &changed,
        &now
    )
    .await
    .unwrap());
    for bad in [
        listing(&signer, wanted.clone(), 101, GENESIS).await,
        listing(&signer, wanted.clone(), 99, &Pubkey::new_unique().to_string()).await,
    ] {
        assert!(renewal::unchanged_and_fresh(
            &mock(Value::Null),
            &bad,
            &record,
            &op,
            GENESIS,
            &wanted,
            &now
        )
        .await
        .is_err());
    }
    let mut corrupted = bytes;
    corrupted[60] ^= 1;
    assert!(renewal::unchanged_and_fresh(
        &mock(Value::Null),
        &corrupted,
        &record,
        &op,
        GENESIS,
        &wanted,
        &now
    )
    .await
    .is_err());
}
#[tokio::test]
async fn finalized_floor_survives_no_pending_restart_and_never_regresses() {
    let dir = tempfile::tempdir().unwrap();
    let record = Pubkey::new_unique();
    receipt(dir.path(), &record);
    assert_eq!(
        renewal::reconcile(&mock(finalized()), dir.path(), &record, GENESIS).await.unwrap(),
        99
    );
    assert_eq!(renewal::read_min_slot(dir.path(), &record, GENESIS).unwrap(), 99);
    assert_eq!(
        renewal::reconcile(&mock(Value::Null), dir.path(), &record, GENESIS).await.unwrap(),
        99
    );
    assert!(renewal::read_min_slot(dir.path(), &Pubkey::new_unique(), GENESIS).is_err());
    // Reappearance of the same receipt after crash recovery cannot lower a later floor.
    std::fs::write(
        dir.path().join("finalized.json"),
        serde_json::to_vec(&json!({"record":record.to_string(),"genesis":GENESIS,"slot":200}))
            .unwrap(),
    )
    .unwrap();
    receipt(dir.path(), &record);
    assert_eq!(
        renewal::reconcile(&mock(finalized()), dir.path(), &record, GENESIS).await.unwrap(),
        200
    );
    assert_eq!(renewal::read_min_slot(dir.path(), &record, GENESIS).unwrap(), 200);
}
#[tokio::test]
async fn malformed_finalized_floor_keeps_pending_and_blocks_recovery() {
    let dir = tempfile::tempdir().unwrap();
    let record = Pubkey::new_unique();
    receipt(dir.path(), &record);
    std::fs::write(dir.path().join("finalized.json"), b"broken").unwrap();
    assert!(renewal::reconcile(&mock(finalized()), dir.path(), &record, GENESIS).await.is_err());
    assert!(dir.path().join("pending.json").exists());
}
struct NeverSign(Pubkey);
#[async_trait::async_trait]
impl SolanaSigner for NeverSign {
    fn pubkey(&self) -> Pubkey {
        self.0
    }
    async fn is_available(&self) -> bool {
        true
    }
    async fn sign_message(&self, _: &[u8]) -> Result<Signature, solana_keychain::SignerError> {
        panic!("stale account read must stop before any signing")
    }
}
#[tokio::test]
async fn lagging_finalized_account_read_cannot_trigger_another_signature() {
    let signer = NeverSign(Pubkey::new_unique());
    let mut config = kora_lib::Config::load_config(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/kora.fixture.toml"
    ))
    .unwrap();
    config.validation.disallowed_accounts = vec![address(&signer.pubkey()).unwrap().to_string()];
    let rpc = RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (RpcRequest::GetGenesisHash, json!(GENESIS)),
            (RpcRequest::GetAccountInfo, json!({"context":{"slot":98},"value":null})),
        ]),
    );
    let dir = tempfile::tempdir().unwrap();
    let journal = dir.path().join("pending.json");
    let error = neiro_kora_publisher::publish_with_min_slot(
        &rpc,
        &config,
        &signer,
        signer.pubkey(),
        Some("https://example.com/"),
        GENESIS,
        &journal,
        99,
    )
    .await
    .unwrap_err();
    assert!(error.to_string().contains("predates finalized receipt"), "{error}");
    assert!(!journal.exists());
}
#[tokio::test]
async fn framed_length_low_byte_brace_is_not_mistaken_for_legacy_json() {
    let signer = Signer::from_memory(&Keypair::new().to_base58_string()).unwrap();
    let op = signer.pubkey();
    let record = address(&op).unwrap();
    let mut wanted = json!({"v":5,"url":"https://x/","operator":op.to_string(),"payment":op.to_string(),"mint":"m","genesis":GENESIS,"price":{"type":"free"},"oracle":"Jupiter"});
    let bytes = listing(&signer, wanted.clone(), 99, GENESIS).await;
    let length = u16::from_le_bytes(bytes[41..43].try_into().unwrap()) as usize;
    assert!(length <= 379);
    wanted["url"] = json!(format!("https://x/{}", "a".repeat(379 - length)));
    let bytes = listing(&signer, wanted.clone(), 99, GENESIS).await;
    assert_eq!(&bytes[41..43], &[b'{', 1]);
    let now = Anchor { slot: 100, hash: GENESIS.into(), time: 1000 };
    assert!(renewal::unchanged_and_fresh(
        &mock(Value::Null),
        &bytes,
        &record,
        &op,
        GENESIS,
        &wanted,
        &now
    )
    .await
    .unwrap());
}
fn clock_response(slot: u64, time: i64) -> Value {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut data = [0u8; 40];
    data[..8].copy_from_slice(&slot.to_le_bytes());
    data[32..].copy_from_slice(&time.to_le_bytes());
    json!({"context":{"slot":slot},"value":[{"owner":"Sysvar1111111111111111111111111111111111111","lamports":1,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(data),"base64"]}]})
}
fn clock_rpc(value: Value) -> RpcClient {
    RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([(RpcRequest::GetMultipleAccounts, value)]),
    )
}
#[tokio::test]
async fn finalized_clock_requires_authentic_shape_valid_timestamp_and_anchor_context() {
    assert_eq!(renewal::chain_time(&clock_rpc(clock_response(100, 1000)), 99).await.unwrap(), 1000);
    let mut malformed = Vec::new();
    malformed.push(json!({"context":{"slot":100},"value":[null]}));
    malformed.push(json!({"context":{"slot":100},"value":[]}));
    malformed.push(clock_response(98, 1000));
    malformed.push(clock_response(100, -1));
    malformed.push(clock_response(100, 9_007_199_254_740_992));
    let mut too_new = clock_response(101, 1000);
    too_new["context"]["slot"] = json!(100);
    malformed.push(too_new);
    for (field, value) in
        [("owner", json!(GENESIS)), ("executable", json!(true)), ("data", json!(["", "base64"]))]
    {
        let mut response = clock_response(100, 1000);
        response["value"][0][field] = value;
        malformed.push(response);
    }
    for value in malformed {
        assert!(renewal::chain_time(&clock_rpc(value.clone()), 99).await.is_err(), "{value}");
    }
}
#[tokio::test]
async fn renewal_uses_clock_even_when_latest_block_time_lags() {
    let signer = Signer::from_memory(&Keypair::new().to_base58_string()).unwrap();
    let op = signer.pubkey();
    let record = address(&op).unwrap();
    let wanted = json!({"v":5,"url":"https://example.com/","operator":op.to_string(),"payment":op.to_string(),"mint":"m","genesis":GENESIS,"price":{"type":"free"},"oracle":"Jupiter"});
    let bytes = listing(&signer, wanted.clone(), 99, GENESIS).await;
    let latest = Anchor { slot: 100, hash: GENESIS.into(), time: 1000 };
    assert!(!renewal::unchanged_and_fresh_at(
        &mock(Value::Null),
        &bytes,
        &record,
        &op,
        GENESIS,
        &wanted,
        &latest,
        87400
    )
    .await
    .unwrap());
    assert!(renewal::unchanged_and_fresh_at(
        &mock(Value::Null),
        &bytes,
        &record,
        &op,
        GENESIS,
        &wanted,
        &latest,
        999
    )
    .await
    .is_err());
}
