// Private environment adapter for container hosting.
import fs from 'node:fs';
import {main} from './runner.ts';
process.umask(0o077);
function required(name: string): string {
  const value=process.env[name];
  if(!value)throw Error('missing environment');
  return value;
}
try {
  const operator=required('OPERATOR'),url=required('OPERATOR_URL'),rpc=required('RPC_URL');
  const config=required('KORA_CONFIG_BASE64'),signers=required('KORA_SIGNERS_BASE64');
  fs.mkdirSync('/tmp/publisher',{recursive:true,mode:0o700});
  fs.mkdirSync('/state',{recursive:true,mode:0o700});fs.chmodSync('/state',0o700);
  for(const [data,file] of [[config,'kora.toml'],[signers,'signers.toml']])
    fs.writeFileSync('/tmp/publisher/'+file,Buffer.from(data,'base64'),{mode:0o600});
  process.env.SOLANA_RPC_URL=rpc;
  await main(['renew','--watch','--operator',operator,'--url',url,
    '--config','/tmp/publisher/kora.toml','--signers-config','/tmp/publisher/signers.toml','--state-dir','/state']);
}catch{console.error('Private publisher startup failed; check service configuration.');process.exitCode=1;}
