# Linux worker only; operators may build the same Rust source natively instead.
FROM debian:bookworm-slim@sha256:a4672c0cb26fbdde88e38fa2dfb6c681942306680e41e4378b28770b6e79ee91
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY neiro-kora-publisher /usr/local/bin/neiro-kora-publisher
COPY run.sh /usr/local/bin/run-publisher
RUN chmod 0555 /usr/local/bin/neiro-kora-publisher /usr/local/bin/run-publisher
ENTRYPOINT ["/usr/local/bin/run-publisher"]
