//! Upstream Kora library checks with a deterministic RPC and its built-in mock
//! oracle. No network, production signer, or real transfer is used here.
use base64::{engine::general_purpose::STANDARD, Engine};
use kora_lib::{
    config::{ProgramsConfig, SplTokenConfig},
    fee::{
        fee::{FeeConfigUtil, TotalFeeCalculation},
        price::PriceModel,
    },
    oracle::PriceSource,
    token::token::TransferHookValidationFlow,
    transaction::TransactionUtil,
    validator::transaction_validator::TransactionValidator,
    Config,
};
use serde_json::json;
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_message::{Message, VersionedMessage};
use solana_sdk::pubkey::Pubkey;
use solana_system_interface::instruction::transfer;
use std::collections::HashMap;
const MINT: &str = "CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump";
fn config(model: PriceModel) -> Config {
    let mut c =
        Config::load_config(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/kora.fixture.toml"))
            .unwrap();
    c.validation.price.model = model;
    c.validation.price_source = PriceSource::Mock;
    c.validation.max_price_staleness_slots = 0; // Mock oracle has no slot; fixture only.
    c.validation.allowed_programs = ProgramsConfig::All;
    c.kora.cache.enabled = false;
    c.validation.allowed_tokens = vec![MINT.into()];
    c.validation.allowed_spl_paid_tokens = SplTokenConfig::Allowlist(vec![MINT.into()]);
    c.validation.max_allowed_lamports = 250_000_000;
    c.validation.disallowed_accounts.clear();
    c
}
fn rpc() -> RpcClient {
    let mut mint = [0u8; 82];
    mint[44] = 6;
    mint[45] = 1;
    RpcClient::new_mock_with_mocks(
        "succeeds".into(),
        HashMap::from([
            (
                RpcRequest::GetAccountInfo,
                json!({"context":{"slot":1000},"value":{"owner":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","lamports":1461600,"executable":false,"rentEpoch":0,"data":[STANDARD.encode(mint),"base64"]}}),
            ),
            (RpcRequest::GetFeeForMessage, json!({"context":{"slot":1000},"value":10000})),
        ]),
    )
}
#[tokio::test]
async fn actual_kora_free_fixed_margin_calculations() {
    let payer = Pubkey::new_unique();
    let sender = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();
    for (name, model, want) in [
        ("free", PriceModel::Free, 0),
        ("fixed", PriceModel::Fixed { amount: 20000, token: MINT.into(), strict: false }, 20000),
        (
            "fixed-strict",
            PriceModel::Fixed { amount: 20000, token: MINT.into(), strict: true },
            20000,
        ),
        ("margin", PriceModel::Margin { margin: 0.05 }, 10553),
    ] {
        let c = config(model);
        let message = VersionedMessage::Legacy(Message::new(
            &[transfer(&sender, &recipient, 1)],
            Some(&payer),
        ));
        let mut tx = TransactionUtil::new_unsigned_versioned_transaction_resolved(message).unwrap();
        let fee = FeeConfigUtil::estimate_kora_fee(
            &mut tx,
            &payer,
            c.validation.is_payment_required(),
            &rpc(),
            &c,
            TransferHookValidationFlow::ImmediateSignAndSend,
            None,
        )
        .await
        .unwrap();
        assert_eq!(fee.total_fee_lamports, want, "{name}");
        TransactionValidator::validate_strict_pricing_with_fee(&c, &fee).unwrap();
        let raw =
            FeeConfigUtil::calculate_fee_in_token(want, Some(MINT), &rpc(), &c).await.unwrap();
        assert_eq!(raw, Some(want), "mock oracle is exactly 1 lamport per raw NEIRO");
    }
}
#[test]
fn strict_fixed_rejects_cost_above_price_including_sub_lamport_price() {
    for amount in [0, 9999, 10000, 10001] {
        for strict in [false, true] {
            let c = config(PriceModel::Fixed { amount, token: MINT.into(), strict });
            let fee = TotalFeeCalculation::new(amount, 10000, 0, 0, 0, 0);
            assert_eq!(
                TransactionValidator::validate_strict_pricing_with_fee(&c, &fee).is_ok(),
                !strict || amount >= 10000
            );
        }
    }
}
#[tokio::test]
async fn missing_oracle_slot_rejected_for_fixed_with_150_slot_guard() {
    let mut c = config(PriceModel::Fixed { amount: 20000, token: MINT.into(), strict: false });
    c.validation.max_price_staleness_slots = 150;
    let error = c
        .validation
        .price
        .get_required_lamports_with_fixed(&rpc(), &c)
        .await
        .unwrap_err()
        .to_string();
    assert!(error.contains("no block_id"), "{error}");
}
#[tokio::test]
async fn free_and_fixed_system_withdrawal_policy_rejects_before_signing() {
    let payer = Pubkey::new_unique();
    let recipient = Pubkey::new_unique();
    for model in
        [PriceModel::Free, PriceModel::Fixed { amount: 20000, token: MINT.into(), strict: false }]
    {
        let mut c = config(model);
        c.validation.fee_payer_policy.system.allow_transfer = false;
        let message = VersionedMessage::Legacy(Message::new(
            &[transfer(&payer, &recipient, 100_000_000)],
            Some(&payer),
        ));
        let mut tx = TransactionUtil::new_unsigned_versioned_transaction_resolved(message).unwrap();
        let error = TransactionValidator::new(&c, payer)
            .unwrap()
            .validate_transaction(&c, &mut tx, &rpc())
            .await
            .unwrap_err()
            .to_string();
        assert!(error.to_lowercase().contains("transfer"), "{error}");
        assert!(error.to_lowercase().contains("fee payer"), "{error}");
        // This is intentionally still permitted when allow_transfer=true. The
        // future sponsor-only gate is not a blanket ban on trusted System transfers.
        c.validation.fee_payer_policy.system.allow_transfer = true;
        let message = VersionedMessage::Legacy(Message::new(
            &[transfer(&payer, &recipient, 100_000_000)],
            Some(&payer),
        ));
        let mut tx = TransactionUtil::new_unsigned_versioned_transaction_resolved(message).unwrap();
        TransactionValidator::new(&c, payer)
            .unwrap()
            .validate_transaction(&c, &mut tx, &rpc())
            .await
            .unwrap();
    }
}
