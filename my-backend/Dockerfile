# The tag is readable; the digest fixes the exact multi-platform builder image.
FROM golang:1.26.8-bookworm@sha256:9fdc884aacc3bec89b20ffc69f4bb369c78210e3e4f600387b5128b12c199f81 AS build
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

# No compiler, shell, source code, migrations, or .env in the runtime image.
FROM scratch AS api
WORKDIR /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/api /app/api
USER 65532:65532
EXPOSE 3001
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD ["/app/api", "healthcheck"]
ENTRYPOINT ["/app/api"]
