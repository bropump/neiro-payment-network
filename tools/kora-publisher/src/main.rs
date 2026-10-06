use anyhow::{ensure, Context, Result};
use clap::{Parser, Subcommand};
use kora_lib::{
    signer::{SignerConfig, SignerPoolConfig},
    Config,
};
use neiro_kora_publisher::{address, guard::verify_live, publish};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::{path::PathBuf, time::Duration};

#[derive(Parser)]
#[command(about = "Operator-only SPL Record administration; does not modify Kora")]
struct Args {
    #[arg(long)]
    operator: Pubkey,
    #[arg(long, default_value = "kora.toml")]
    config: PathBuf,
    #[arg(long, default_value = "signers.toml")]
    signers_config: PathBuf,
    #[arg(long)]
    signer_name: Option<String>,
    #[arg(long, env = "SOLANA_RPC_URL", default_value = "https://api.mainnet-beta.solana.com")]
    rpc_url: String,
    #[arg(long, default_value = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d")]
    genesis: String,
    #[command(subcommand)]
    action: Action,
}

#[derive(Subcommand)]
enum Action {
    /// Derive the listing address without reading signer credentials.
    Address,
    /// Create the listing or update changed terms; identical terms are a no-op.
    Publish {
        #[arg(long)]
        url: String,
        #[arg(long)]
        journal: PathBuf,
    },
    /// Close the listing and return its rent to the operator.
    Close {
        #[arg(long)]
        journal: PathBuf,
    },
}

async fn run(a: Args) -> Result<()> {
    let record = address(&a.operator)?;
    if matches!(a.action, Action::Address) {
        println!("{record}");
        return Ok(());
    }
    let config = Config::load_config(&a.config)?;
    let (url, journal) = match &a.action {
        Action::Publish { url, journal } => (Some(url.as_str()), journal),
        Action::Close { journal } => (None, journal),
        Action::Address => unreachable!(),
    };
    ensure!(!journal.exists(), "journal already exists; reconcile its signature first");
    if let Some(endpoint) = url {
        let u = url::Url::parse(endpoint)?;
        ensure!(
            u.scheme() == "https"
                && u.host_str().is_some()
                && u.username().is_empty()
                && u.password().is_none()
                && u.query().is_none()
                && u.fragment().is_none(),
            "HTTPS endpoint required"
        );
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        let r: serde_json::Value = client
            .post(endpoint)
            .json(&serde_json::json!({"jsonrpc":"2.0","id":1,"method":"getConfig","params":{}}))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        ensure!(
            r["jsonrpc"] == "2.0" && r["id"] == 1 && r.get("error").is_none(),
            "invalid getConfig response"
        );
        let p: serde_json::Value = client
            .post(endpoint)
            .json(
                &serde_json::json!({"jsonrpc":"2.0","id":2,"method":"getPayerSigner","params":{}}),
            )
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        ensure!(
            p["jsonrpc"] == "2.0" && p["id"] == 2 && p.get("error").is_none(),
            "invalid payer response"
        );
        verify_live(&config, a.operator, &r["result"], &p["result"])?;
    }
    let signers = SignerPoolConfig::load_config(&a.signers_config)?;
    let candidates: Vec<_> = signers
        .signers
        .iter()
        .filter(|s| a.signer_name.as_ref().is_none_or(|n| n == &s.name))
        .collect();
    ensure!(candidates.len() == 1, "select exactly one configured signer with --signer-name");
    let signer = SignerConfig::build_signer_from_config(candidates[0]).await?;
    let rpc = RpcClient::new_with_timeout_and_commitment(
        a.rpc_url,
        Duration::from_secs(30),
        CommitmentConfig::finalized(),
    );
    if publish(&rpc, &config, &signer, a.operator, url, &a.genesis, journal).await?.is_none() {
        println!("Unchanged; no transaction sent");
    }
    Ok(())
}

#[tokio::main]
async fn main() {
    // Do not print backend errors: they can contain RPC URLs or signing credentials.
    if run(Args::parse()).await.context("publisher failed").is_err() {
        eprintln!("Publisher failed. Check config, signer selection and live listing guard. If a signature journal exists, reconcile it before retrying.");
        std::process::exit(1);
    }
}
