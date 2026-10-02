# One HTTPS address for Kora and its proof

The router needs one hostname with two routes: a small public verification file and the Kora API. The proof file must be served independently of Kora. This Caddy example works with a local backend or can be adapted to a cloud backend. A host with equivalent ingress rules can implement those directly.

Install [Caddy](https://caddyserver.com/docs/install) using its instructions for your host. Keep public files in a dedicated subdirectory, never the folder containing keys or the two Kora config files.

```sh
export NEIRO_OPERATOR_DIR="$HOME/.config/neiro-operator"
mkdir -p "$NEIRO_OPERATOR_DIR/public/.well-known/neiro-router"
```

Save this as `Caddyfile` in the private operator directory. Replace `/ABSOLUTE/PATH/public` with the absolute path to that public subdirectory:

```caddyfile
http://127.0.0.1:8081 {
    handle /.well-known/neiro-router/* {
        root * /ABSOLUTE/PATH/public
        header Content-Type application/json
        file_server
    }
    handle {
        reverse_proxy 127.0.0.1:8080
    }
}
```

Validate and start the proxy in a second terminal:

```sh
caddy validate --config "$NEIRO_OPERATOR_DIR/Caddyfile" --adapter caddyfile
caddy run --config "$NEIRO_OPERATOR_DIR/Caddyfile" --adapter caddyfile
```

For a first local test, install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and run a [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) in another terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:8081
```

Use the printed HTTPS address as `KORA_ENDPOINT` in [registration](REGISTRATION.md). This exposes your configured Kora service publicly. Quick Tunnel addresses are temporary; use a stable named tunnel/custom hostname for unattended operation. An address change requires updating registration, so choose the stable endpoint before calling the setup complete.

After registering, copy only the returned verification JSON into the public tree (use the `OPERATOR_ID` from the registration instructions):

```sh
jq '.verification' registration.json > "$NEIRO_OPERATOR_DIR/public/.well-known/neiro-router/$OPERATOR_ID"
curl --fail --silent --show-error "$(jq -r '.verificationUrl' registration.json)"
```

Expect the same token and `enabled: true`, not a redirect or HTML. Then call verify and run the routed quote check. Keep Kora, Caddy and the tunnel running. In the unattended stage, arrange restart for all three, preserve the proof and use a stable URL.

## Cloud backend or direct public host

On a public server with DNS and ports 80/443 routed to Caddy, replace `http://127.0.0.1:8081` with your hostname; Caddy can manage HTTPS. For a cloud Kora backend, replace `127.0.0.1:8080` with its reachable address. For an HTTPS backend, use its actual hostname and a matching upstream Host header:

```caddyfile
reverse_proxy https://YOUR-KORA-BACKEND-HOST {
    header_up Host {upstream_hostport}
}
```

Do not point the proxy at its own public hostname. The front host must store the proof persistently and reach the backend. Keep secrets entirely out of the public directory. See Caddy's [handle](https://caddyserver.com/docs/caddyfile/directives/handle) and [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) documentation. This is a routing example, not a requirement to use Caddy on every platform.
