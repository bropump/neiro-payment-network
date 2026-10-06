use crate::{address, MINT};
use anyhow::{ensure, Result};
use kora_lib::{config::SplTokenConfig, Config};
use serde_json::{json, Value};
use solana_sdk::pubkey::Pubkey;

/// Operational check of the responding instance, not a proof about every replica.
pub fn verify_live(config: &Config, op: Pubkey, live: &Value, payer: &Value) -> Result<()> {
    ensure!(
        live["fee_payers"].as_array().is_some_and(|xs| xs.contains(&json!(op.to_string()))),
        "operator not served by endpoint"
    );
    let record = address(&op)?.to_string();
    let v = &live["validation_config"];
    ensure!(
        v["disallowed_accounts"].as_array().is_some_and(|xs| xs.contains(&json!(record))),
        "running Kora does not deny listing"
    );
    ensure!(
        v["price"] == serde_json::to_value(&config.validation.price)?
            && v["price_source"] == serde_json::to_value(&config.validation.price_source)?,
        "running price differs from local config"
    );
    ensure!(
        v["allowed_tokens"].as_array().is_some_and(|xs| xs.contains(&json!(MINT))),
        "running Kora does not accept NEIRO"
    );
    let paid: SplTokenConfig = serde_json::from_value(v["allowed_spl_paid_tokens"].clone())?;
    ensure!(paid.has_token(MINT), "running Kora does not accept NEIRO fees");
    ensure!(
        payer["signer_address"] == op.to_string()
            && payer["payment_address"] == config.kora.get_payment_address(&op)?.to_string(),
        "running signer/payment differs"
    );
    Ok(())
}
