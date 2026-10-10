# The tag is readable; the digest fixes the exact multi-platform builder image.
FROM golang:1.26.9-bookworm@sha256:d9c68c2c51161e12fd77e4c6320687c9cd86e1af1e3ad6e6cd63ff970641453c AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOTOOLCHAIN=local

# Dependency downloads stay cached when only application source changes.
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/api ./cmd/api

FROM build AS collector-build
RUN go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/collector ./cmd/collector

FROM scratch AS collector
WORKDIR /app
COPY --from=collector-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=collector-build /out/collector /app/collector
USER 65532:65532
HEALTHCHECK --interval=5s --timeout=2s --start-period=3s --retries=6 CMD ["/app/collector", "healthcheck"]
ENTRYPOINT ["/app/collector"]

# Explicit one-shot migration image; migrations never run inside the API process.
FROM build AS migrate-build
WORKDIR /tools
COPY tools/go.mod tools/go.sum ./
RUN go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/tern github.com/jackc/tern/v2

FROM scratch AS migrate
WORKDIR /app
# Tern/pgx resolves an OS username while loading config, even with a URL supplied.
# scratch has no /etc/passwd; pure-Go os/user uses these explicit defaults.
ENV USER=app_migrator HOME=/app
COPY --from=migrate-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=migrate-build /out/tern /app/tern
COPY migrations/ /app/migrations/
COPY tern.conf /app/tern.conf
USER 65532:65532
ENTRYPOINT ["/app/tern"]
CMD ["migrate", "--config", "/app/tern.conf", "--migrations", "/app/migrations"]

# No compiler, shell, source code, migrations, or .env in the API runtime image.
FROM scratch AS api
WORKDIR /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/api /app/api
USER 65532:65532
EXPOSE 3001
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD ["/app/api", "healthcheck"]
ENTRYPOINT ["/app/api"]
