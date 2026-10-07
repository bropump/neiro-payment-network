//! Local Surfpool integration. Never loads a real wallet. Requires loopback RPC.
use anyhow::{ensure, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use kora_lib::{config::SplTokenConfig, Config};
use neiro_kora_publisher::{address, publish, renewal::reconcile, PROGRAM};
use serde_json::{json, Value};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_request::RpcRequest};
use solana_commitment_config::CommitmentConfig;
use solana_keychain::{Signer, SolanaSigner};
use solana_sdk::signature::Keypair;
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};
async fn snapshot(
    rpc: &RpcClient,
    rec: &solana_sdk::pubkey::Pubkey,
    genesis: &str,
) -> Result<Value> {
    let a = rpc.get_account(rec).await?;
    let n = u16::from_le_bytes(a.data[41..43].try_into()?) as usize;
    let body: Value = serde_json::from_slice(&a.data[43..43 + n])?;
    let clock = rpc.get_account(&"SysvarC1ock11111111111111111111111111111111".parse()?).await?;
    let now_time = i64::from_le_bytes(clock.data[32..40].try_into()?);
    let anchor =
        neiro_kora_publisher::renewal::block_anchor(rpc, body["anchor_slot"].as_u64().unwrap())
            .await?;
    Ok(
        json!({"record":rec.to_string(),"genesis":genesis,"account":{"owner":a.owner.to_string(),"lamports":a.lamports,"executable":a.executable,"data":[STANDARD.encode(a.data),"base64"]},"context":{"nowUnixSeconds":now_time,"anchorSlot":anchor.slot,"anchorBlockhash":anchor.hash,"anchorBlockTime":anchor.time}}),
    )
}
#[tokio::test]
#[ignore = "start Surfpool and set SURFPOOL_RPC=http://127.0.0.1:18999"]
async fn lifecycle_and_chain_time() -> Result<()> {
    let endpoint = std::env::var("SURFPOOL_RPC")?;
    let u = url::Url::parse(&endpoint)?;
    ensure!(
        u.scheme() == "http" && matches!(u.host_str(), Some("127.0.0.1") | Some("localhost")),
        "local only"
    );
    let out = PathBuf::from(std::env::var("SURFPOOL_EVIDENCE")?);
    std::fs::create_dir_all(&out)?;
    let rpc = RpcClient::new_with_timeout_and_commitment(
        endpoint,
        Duration::from_secs(30),
        CommitmentConfig::finalized(),
    );
    let signer = Signer::from_memory(&Keypair::new().to_base58_string())?;
    let op = signer.pubkey();
    let rec = address(&op)?;
    let genesis = rpc.get_genesis_hash().await?.to_string();
    let _: Value = rpc
        .send(
            RpcRequest::Custom { method: "surfnet_setAccount" },
            json!([op.to_string(),{"lamports":100_000_000}]),
        )
        .await?;
    let _: Value = rpc.send(RpcRequest::Custom { method: "surfnet_setAccount" }, json!([rec.to_string(), {"lamports":1,"owner":"11111111111111111111111111111111","data":""}])).await?;
    let mut c =
        Config::load_config(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/kora.fixture.toml"))?;
    c.validation.disallowed_accounts = vec![rec.to_string()];
    c.validation.allowed_tokens = vec![neiro_kora_publisher::MINT.into()];
    c.validation.allowed_spl_paid_tokens =
        SplTokenConfig::Allowlist(c.validation.allowed_tokens.clone());
    let start = Instant::now();
    let state = tempfile::tempdir()?;
    let pending = state.path().join("pending.json");
    let sig = publish(&rpc, &c, &signer, op, Some("https://operator.example/"), &genesis, &pending)
        .await?
        .unwrap();
    let create_ms = start.elapsed().as_secs_f64() * 1000.;
    reconcile(&rpc, state.path(), &rec, &genesis).await?;
    let first = snapshot(&rpc, &rec, &genesis).await?;
    std::fs::write(out.join("created.json"), serde_json::to_vec_pretty(&first)?)?;
    let balance = rpc.get_balance(&op).await?;
    ensure!(
        publish(&rpc, &c, &signer, op, Some("https://operator.example/"), &genesis, &pending)
            .await?
            .is_none(),
        "early rewrite"
    );
    ensure!(rpc.get_balance(&op).await? == balance, "no-op charged fee");
    let anchor_time = first["context"]["anchorBlockTime"].as_i64().unwrap();
    let _: Value = rpc
        .send(
            RpcRequest::Custom { method: "surfnet_timeTravel" },
            json!([{"absoluteTimestamp":(anchor_time+86520)*1000}]),
        )
        .await?;
    tokio::time::sleep(Duration::from_secs(15)).await;
    let start = Instant::now();
    let renewed =
        publish(&rpc, &c, &signer, op, Some("https://operator.example/"), &genesis, &pending)
            .await?
            .unwrap();
    let renew_ms = start.elapsed().as_secs_f64() * 1000.;
    reconcile(&rpc, state.path(), &rec, &genesis).await?;
    let fresh = snapshot(&rpc, &rec, &genesis).await?;
    std::fs::write(out.join("renewed.json"), serde_json::to_vec_pretty(&fresh)?)?;
    ensure!(
        rpc.get_account(&rec).await?.lamports == first["account"]["lamports"].as_u64().unwrap(),
        "rent changed"
    );
    // Endpoint change must publish immediately, despite the new anchor being less than 24h old.
    let changed =
        publish(&rpc, &c, &signer, op, Some("https://changed.example/"), &genesis, &pending)
            .await?
            .unwrap();
    reconcile(&rpc, state.path(), &rec, &genesis).await?;
    let before_expiry = snapshot(&rpc, &rec, &genesis).await?;
    let changed_time = before_expiry["context"]["anchorBlockTime"].as_i64().unwrap();
    let _: Value = rpc
        .send(
            RpcRequest::Custom { method: "surfnet_timeTravel" },
            json!([{"absoluteTimestamp":(changed_time+172920)*1000}]),
        )
        .await?;
    tokio::time::sleep(Duration::from_secs(15)).await;
    let expired = snapshot(&rpc, &rec, &genesis).await?;
    std::fs::write(out.join("expired.json"), serde_json::to_vec_pretty(&expired)?)?;
    let close = publish(&rpc, &c, &signer, op, None, &genesis, &pending).await?.unwrap();
    ensure!(
        rpc.get_account_with_commitment(&rec, CommitmentConfig::finalized()).await?.value.is_none(),
        "record remains"
    );
    let final_balance = rpc.get_balance(&op).await?;
    ensure!(final_balance == 100_000_001 - 20_000, "unexpected loss: {final_balance}");
    let summary = json!({"network":"Surfpool only","operator":op.to_string(),"record":rec.to_string(),"program":PROGRAM.to_string(),"create":sig.to_string(),"renew":renewed.to_string(),"change":changed.to_string(),"close":close.to_string(),"create_ms":create_ms,"renew_ms":renew_ms,"rent_recovered":first["account"]["lamports"],"network_fees":20000,"final_balance":final_balance});
    std::fs::write(out.join("summary.json"), serde_json::to_vec_pretty(&summary)?)?;
    println!("{}", summary);
    Ok(())
}
