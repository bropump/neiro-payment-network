# Expose the operator's Kora endpoint

Clients read the endpoint from the operator's onchain listing and call Kora directly. Use a stable public HTTPS URL. No static verification file or extra proof route is required.

Use your host's ingress, reverse proxy or stable tunnel. For example, on a server with DNS and ports 80/443 routed to [Caddy](https://caddyserver.com/docs/install):

```caddyfile
kora.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Replace the hostname and backend with your deployment's values. Keep Kora's configuration and keys outside any publicly served path. Preserve authentication and request limits; check that the publisher and intended clients support your chosen access configuration. See Caddy's [reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

A temporary tunnel can be useful for a bounded test, but its URL stops working when the tunnel stops. For an operating listing, choose a stable endpoint, arrange restart using normal host tools, and verify it from outside the host. If the endpoint changes, republish the listing.

Before [publishing](REGISTRATION.md), verify the live operator identity, advertised terms and listing-account deny protection through this endpoint. HTTPS reachability alone does not prove safe transaction signing.
