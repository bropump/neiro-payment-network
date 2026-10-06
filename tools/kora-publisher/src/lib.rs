//! Local administration only; the running Kora must deny this record via disallowed_accounts.
use anyhow::{anyhow, ensure, Context, Result};
use kora_lib::Config;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_keychain::SolanaSigner;
use solana_message::{Message, VersionedMessage};
use solana_sdk::{pubkey::Pubkey, signature::Signature};
use solana_system_interface::instruction::{create_account_with_seed, transfer_with_seed};
use solana_transaction::versioned::VersionedTransaction;
use spl_record::instruction::{close_account, initialize, write};
use std::{io::Write, path::Path};
pub mod guard;

pub const PROGRAM: Pubkey = solana_sdk::pubkey!("recr1L3PCGKLbckBqMNcJhuuyU1zgo8nBhfLVsJNwr5");
pub const SEED: &str = "neiro-kora-fees";
pub const MINT: &str = "CTg3ZgYx79zrE1MteDVkmkcGniiFrK1hJ6yiabropump";
pub const SPACE: usize = 733;
pub fn address(op: &Pubkey) -> Result<Pubkey> {
    Ok(Pubkey::create_with_seed(op, SEED, &PROGRAM)?)
}
/// Some(url) publishes/updates; None closes and returns rent to the same op.
pub async fn publish(
    rpc: &RpcClient,
    config: &Config,
    signer: &impl SolanaSigner,
    op: Pubkey,
    url: Option<&str>,
    genesis: &str,
    journal: &Path,
) -> Result<Option<Signature>> {
    ensure!(!journal.exists(), "journal exists; reconcile before retrying");
    ensure!(signer.pubkey() == op, "signer mismatch");
    ensure!(rpc.get_genesis_hash().await?.to_string() == genesis, "wrong RPC network");
    let record = address(&op)?;
    let denied = config.validation.disallowed_accounts.contains(&record.to_string());
    ensure!(url.is_none() || denied, "deny {record} in running Kora before publishing");
    let header = [vec![1], op.to_bytes().to_vec()].concat();
    let mut current = rpc.get_account_with_commitment(&record, rpc.commitment()).await?.value;
    let mut ixs = vec![];
    // Anyone can pre-fund this address; recover that SOL before atomically creating the record.
    if let Some(a) = current.as_ref().filter(|a| {
        url.is_some()
            && a.owner == solana_system_interface::program::ID
            && a.data.is_empty()
            && !a.executable
    }) {
        ixs.push(transfer_with_seed(&record, &op, SEED.into(), &PROGRAM, &op, a.lamports));
        current = None;
    }
    if let Some(a) = &current {
        ensure!(a.owner == PROGRAM && a.data.len() == SPACE, "wrong record owner/layout");
        ensure!(!a.executable && a.data.starts_with(&header), "wrong record authority");
    } else if url.is_none() {
        return Ok(None);
    }
    if let Some(url) = url {
        let parsed = url::Url::parse(url)?;
        ensure!(
            parsed.scheme() == "https"
                && parsed.host_str().is_some()
                && parsed.username().is_empty()
                && parsed.password().is_none()
                && parsed.query().is_none()
                && parsed.fragment().is_none(),
            "public HTTPS URL required"
        );
        let validation = &config.validation;
        ensure!(
            validation.allowed_tokens.iter().any(|s| s == MINT)
                && validation.allowed_spl_paid_tokens.has_token(MINT),
            "NEIRO not accepted"
        );
        let data = serde_json::to_vec(&serde_json::json!({
            "v":1, "url":parsed.as_str(), "operator":op.to_string(),
            "payment":config.kora.get_payment_address(&op)?.to_string(), "mint":MINT,
            "genesis":genesis,
            "price":validation.price, "oracle":validation.price_source
        }))?;
        let mut payload = [b"NKORAF01".as_slice(), &data].concat();
        ensure!(payload.len() <= SPACE - 33, "listing too large");
        payload.resize(SPACE - 33, 0);
        if current.as_ref().is_some_and(|a| a.data[33..] == payload) {
            return Ok(None);
        }
        if current.is_none() {
            let rent = rpc.get_minimum_balance_for_rent_exemption(SPACE).await?;
            ensure!(rent <= 7_000_000, "rent cap exceeded");
            let size = SPACE as u64;
            ixs.push(create_account_with_seed(&op, &record, &op, SEED, rent, size, &PROGRAM));
            ixs.push(initialize(&record, &op));
        }
        ixs.push(write(&record, &op, 0, &payload));
    } else {
        ixs.push(close_account(&record, &op, &op));
    }
    let hash = rpc.get_latest_blockhash().await?;
    let message = Message::new_with_blockhash(&ixs, Some(&op), &hash);
    ensure!(rpc.get_fee_for_message(&message).await? <= 10_000, "fee cap exceeded");
    let mut tx = VersionedTransaction {
        signatures: vec![Signature::default()],
        message: VersionedMessage::Legacy(message),
    };
    ensure!(bincode::serialize(&tx)?.len() <= 1232, "transaction exceeds packet size");
    let bytes = tx.message.serialize();
    let signature = signer.sign_message(&bytes).await.map_err(|_| anyhow!("signing failed"))?;
    ensure!(signature.verify(op.as_ref(), &bytes), "invalid backend signature");
    tx.signatures[0] = signature;
    let mut log = std::fs::OpenOptions::new().write(true).create_new(true).open(journal)?;
    writeln!(
        log,
        "{}",
        serde_json::json!({"record":record.to_string(), "signature":signature.to_string(), "genesis":genesis})
    )?;
    log.sync_all()?;
    let parent = journal.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    std::fs::File::open(parent)?.sync_all()?;
    println!("Record {record}; transaction {signature}. Reconcile this signature before retrying.");
    let sent = rpc
        .send_and_confirm_transaction(&tx)
        .await
        .with_context(|| format!("check transaction {signature} before retrying"))?;
    ensure!(sent == signature, "RPC signature mismatch: expected {signature}");
    Ok(Some(signature))
}
