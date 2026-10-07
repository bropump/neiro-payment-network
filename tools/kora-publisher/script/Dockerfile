# Container packaging for the listing runner.
FROM node:24-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
WORKDIR /app/script
COPY script/package.json script/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-fund --registry=https://registry.npmjs.org && npm cache clean --force
COPY script/*.ts ./
COPY client/read-record.mjs client/verify-quote.mjs /app/client/
ENTRYPOINT ["node", "/app/script/start-container.ts"]
