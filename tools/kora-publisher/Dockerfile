# Same glibc baseline as the pinned official Kora Dockerfile.
FROM rust:1.97-bookworm AS build
WORKDIR /publisher
COPY . .
RUN rustup toolchain install nightly-2026-07-13 --profile minimal \
    && cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home publisher
COPY --from=build /publisher/target/release/neiro-kora-publisher /usr/local/bin/
USER publisher
WORKDIR /home/publisher
ENTRYPOINT ["neiro-kora-publisher"]
