//! Chain time determines validity; the host clock only schedules wakeups.
use crate::{attestation_message, MAGIC};
use anyhow::{ensure, Context, Result};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_sdk::{pubkey::Pubkey, signature::Signature};
use std::{fs::File, path::Path};
pub const RENEW_AFTER: i64 = 86_400;
pub const EXPIRE_AFTER: i64 = 172_800;
#[derive(Debug)]
pub struct Anchor {
    pub slot: u64,
    pub hash: String,
    pub time: i64,
}
pub async fn block_anchor(rpc: &RpcClient, slot: u64) -> Result<Anchor> {
    ensure!(slot <= 9_007_199_254_740_991, "unsafe slot");
    let b: Value = rpc
        .send(
            RpcRequest::GetBlock,
            json!([slot, {
                "commitment":"finalized", "transactionDetails":"none", "rewards":false,
                "maxSupportedTransactionVersion":0
            }]),
        )
        .await?;
    let hash = b["blockhash"].as_str().context("missing finalized block hash")?.to_owned();
    let _: Pubkey = hash.parse()?;
    let time = b["blockTime"].as_i64().context("missing finalized block time")?;
    ensure!((0..=9_007_199_254_740_991).contains(&time), "invalid block time");
    Ok(Anchor { slot, hash, time })
}
pub async fn latest_anchor(rpc: &RpcClient) -> Result<Anchor> {
    let slot: u64 = rpc.send(RpcRequest::GetSlot, json!([{"commitment":"finalized"}])).await?;
    block_anchor(rpc, slot).await
}
/// Read current finalized consensus time after the selected anchor; never use host time.
pub async fn chain_time(rpc: &RpcClient, min_slot: u64) -> Result<i64> {
    let clock = solana_sdk::pubkey!("SysvarC1ock11111111111111111111111111111111");
    let response = rpc
        .get_multiple_accounts_with_commitment(
            &[clock],
            solana_commitment_config::CommitmentConfig::finalized(),
        )
        .await?;
    ensure!(response.context.slot >= min_slot, "Clock context predates anchor");
    let account =
        response.value.first().and_then(Option::as_ref).context("missing finalized Clock")?;
    ensure!(
        account.owner == solana_sdk::pubkey!("Sysvar1111111111111111111111111111111111111")
            && !account.executable
            && account.data.len() == 40,
        "invalid Clock account"
    );
    let slot = u64::from_le_bytes(account.data[..8].try_into()?);
    ensure!(slot >= min_slot && slot <= response.context.slot, "inconsistent Clock slot");
    let time = i64::from_le_bytes(account.data[32..40].try_into()?);
    ensure!((0..=9_007_199_254_740_991).contains(&time), "invalid Clock timestamp");
    Ok(time)
}
/// Deterministic compatibility helper. Production publication uses finalized Clock below.
pub async fn unchanged_and_fresh(
    rpc: &RpcClient,
    bytes: &[u8],
    record: &Pubkey,
    op: &Pubkey,
    genesis: &str,
    wanted: &Value,
    now: &Anchor,
) -> Result<bool> {
    unchanged_and_fresh_at(rpc, bytes, record, op, genesis, wanted, now, now.time).await
}
pub async fn unchanged_and_fresh_at(
    rpc: &RpcClient,
    bytes: &[u8],
    record: &Pubkey,
    op: &Pubkey,
    genesis: &str,
    wanted: &Value,
    now: &Anchor,
    now_time: i64,
) -> Result<bool> {
    ensure!(now.time <= now_time, "latest anchor ahead of finalized Clock");
    // Known old formats migrate in place. Invalid v5 proofs never trigger automatic repair.
    if &bytes[33..41] != MAGIC {
        return Ok(false);
    }
    if &bytes[41..43] == b"{\"" {
        let end = bytes[41..].iter().position(|b| *b == 0).map_or(bytes.len(), |i| 41 + i);
        let legacy: Value = serde_json::from_slice(&bytes[41..end])?;
        ensure!(legacy["v"] == 1, "unsupported legacy listing");
        return Ok(false);
    }
    let len = u16::from_le_bytes(bytes[41..43].try_into()?) as usize;
    if len == 0 || 43 + len + 64 > bytes.len() {
        anyhow::bail!("malformed listing");
    }
    let raw = &bytes[43..43 + len];
    let mut old: Value = serde_json::from_slice(raw)?;
    if matches!(old["v"].as_u64(), Some(1..=4)) {
        return Ok(false);
    }
    ensure!(
        old["v"] == 5 && old.as_object().context("listing object")?.len() == 10,
        "unsupported listing schema"
    );
    let sig = Signature::try_from(&bytes[43 + len..43 + len + 64])?;
    ensure!(
        sig.verify(op.as_ref(), &attestation_message(record, genesis, raw)?),
        "invalid old proof"
    );
    ensure!(bytes[43 + len + 64..].iter().all(|b| *b == 0), "invalid padding");
    let slot = old["anchor_slot"].as_u64().context("invalid anchor slot")?;
    ensure!(slot <= now.slot, "future anchor slot");
    let fetched;
    let anchor = if slot == now.slot {
        now
    } else {
        fetched = block_anchor(rpc, slot).await?;
        &fetched
    };
    ensure!(old["anchor_blockhash"] == anchor.hash && anchor.time <= now_time, "invalid anchor");
    old.as_object_mut().unwrap().remove("anchor_slot");
    old.as_object_mut().unwrap().remove("anchor_blockhash");
    Ok(old == *wanted && now_time - anchor.time < RENEW_AFTER)
}
/// OS lock covers the whole renew invocation; a crash releases it automatically.
pub fn lock_state(dir: &Path) -> Result<File> {
    std::fs::create_dir_all(dir)?;
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(dir.join("lock"))?;
    lock.try_lock().context("another publisher holds the state lock")?;
    Ok(lock)
}
pub fn sync_directory(dir: &Path) -> Result<()> {
    #[cfg(unix)]
    File::open(dir)?.sync_all()?;
    #[cfg(not(unix))]
    {
        let _ = dir;
    }
    Ok(())
}
/// Durable minimum account context established by earlier successful publications.
pub fn read_min_slot(state: &Path, record: &Pubkey, genesis: &str) -> Result<u64> {
    let path = state.join("finalized.json");
    if !path.exists() {
        return Ok(0);
    }
    let floor: Value = serde_json::from_slice(&std::fs::read(path)?)?;
    ensure!(
        floor["record"] == record.to_string() && floor["genesis"] == genesis,
        "wrong finalized state identity"
    );
    floor["slot"].as_u64().context("invalid finalized slot")
}
fn persist_min_slot(state: &Path, record: &Pubkey, genesis: &str, slot: u64) -> Result<()> {
    use std::io::Write;
    // The caller holds the state lock. A stale temporary file after a crash is safe to replace.
    let temp = state.join("finalized.tmp");
    let mut file =
        std::fs::OpenOptions::new().write(true).create(true).truncate(true).open(&temp)?;
    serde_json::to_writer(
        &mut file,
        &json!({"record":record.to_string(),"genesis":genesis,"slot":slot}),
    )?;
    file.flush()?;
    file.sync_all()?;
    std::fs::rename(&temp, state.join("finalized.json"))?;
    sync_directory(state)
}
/// Never clear ambiguous receipts. Only a finalized successful transaction is archived.
/// Persist its slot before removal so a lagging RPC cannot cause a duplicate renewal.
pub async fn reconcile(
    rpc: &RpcClient,
    state: &Path,
    record: &Pubkey,
    genesis: &str,
) -> Result<u64> {
    let floor = read_min_slot(state, record, genesis)?;
    let pending = state.join("pending.json");
    if !pending.exists() {
        return Ok(floor);
    }
    let r: Value = serde_json::from_slice(&std::fs::read(&pending)?)?;
    ensure!(r["record"] == record.to_string() && r["genesis"] == genesis, "wrong receipt identity");
    ensure!(rpc.get_genesis_hash().await?.to_string() == genesis, "wrong reconciliation network");
    let signature: Signature = r["signature"].as_str().context("missing signature")?.parse()?;
    let status = rpc.get_signature_statuses_with_history(&[signature]).await?;
    let status = status
        .value
        .first()
        .and_then(Option::as_ref)
        .context("unresolved pending transaction; inspect receipt")?;
    ensure!(
        status.err.is_none() && status.confirmations.is_none(),
        "pending transaction not finalized successfully"
    );
    let archive = state.join(format!("{signature}.json"));
    // An existing archive after a crash must contain exactly the same receipt.
    if archive.exists() {
        ensure!(std::fs::read(&archive)? == std::fs::read(&pending)?, "receipt archive conflict");
    } else {
        std::fs::hard_link(&pending, &archive)?;
        sync_directory(state)?;
    }
    let floor = floor.max(status.slot);
    persist_min_slot(state, record, genesis, floor)?;
    std::fs::remove_file(&pending)?;
    sync_directory(state)?;
    Ok(floor)
}
