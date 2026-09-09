package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/palyndav/my-backend/internal/telemetry"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("collector stopped", "code", "collector_failed")
		os.Exit(1)
	}
}
func run(logger *slog.Logger) error {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		client := http.Client{Timeout: time.Second}
		response, err := client.Get("http://127.0.0.1:5515/health/live")
		if err != nil {
			return err
		}
		defer func() { _ = response.Body.Close() }()
		if response.StatusCode != 200 {
			return fmt.Errorf("collector not alive")
		}
		return nil
	}
	if len(os.Args) != 1 {
		return fmt.Errorf("usage: collector [healthcheck]")
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil || os.Getenv("DATABASE_URL") == "" {
		return errors.New("collector requires DATABASE_URL")
	}
	cfg.MaxConns = 2
	cfg.ConnConfig.ConnectTimeout = time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg) // No startup Ping: receive even when DB is down.
	if err != nil {
		return err
	}
	defer pool.Close()
	collector, err := telemetry.NewCollector(telemetry.Store{Pool: pool})
	if err != nil {
		return err
	}
	conn, err := net.ListenPacket("udp", "127.0.0.1:5514")
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	server := http.Server{Addr: "127.0.0.1:5515", Handler: mux, ReadHeaderTimeout: time.Second}
	defer func() { _ = server.Close() }()
	failures := make(chan error, 2)
	go func() { failures <- server.ListenAndServe() }()
	receiverDone := make(chan struct{})
	go func() { defer close(receiverDone); failures <- collector.Receive(ctx, conn) }()
	writerDone := make(chan struct{})
	go func() { defer close(writerDone); collector.RunWriter(ctx, logger) }()
	logger.Info("collector listening", "source", "nginx", "flush_seconds", 5, "buffer_batches", 120)
	select {
	case <-ctx.Done():
	case err = <-failures:
	}
	cancel()
	<-receiverDone
	<-writerDone
	finalCtx, finalCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer finalCancel()
	if flushErr := collector.Drain(finalCtx); flushErr != nil {
		logger.Warn("unflushed summaries lost on shutdown", "code", "telemetry_shutdown_gap")
	}
	return err
}
