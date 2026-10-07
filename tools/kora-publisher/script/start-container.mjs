// Hosting adapter only. The same runner.mjs is run directly on non-container hosts.
import fs from 'node:fs';
import {main} from './runner.mjs';
process.umask(0o077);
try {
  for(const name of ['OPERATOR','OPERATOR_URL','KORA_CONFIG_BASE64','KORA_SIGNERS_BASE64','RPC_URL'])if(!process.env[name])throw Error('missing environment');
  fs.mkdirSync('/tmp/publisher',{recursive:true,mode:0o700});
  fs.mkdirSync('/state',{recursive:true,mode:0o700});fs.chmodSync('/state',0o700);
  for(const [name,file] of [['KORA_CONFIG_BASE64','kora.toml'],['KORA_SIGNERS_BASE64','signers.toml']])fs.writeFileSync('/tmp/publisher/'+file,Buffer.from(process.env[name],'base64'),{mode:0o600});
  process.env.SOLANA_RPC_URL=process.env.RPC_URL;
  await main(['renew','--watch','--operator',process.env.OPERATOR,'--url',process.env.OPERATOR_URL,
    '--config','/tmp/publisher/kora.toml','--signers-config','/tmp/publisher/signers.toml','--state-dir','/state']);
}catch{console.error('Private publisher startup failed; check service configuration.');process.exitCode=1;}
