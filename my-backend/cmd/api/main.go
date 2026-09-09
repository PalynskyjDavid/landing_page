package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/palyndav/my-backend/internal/config"
	"github.com/palyndav/my-backend/internal/database/postgresql"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
	"github.com/palyndav/my-backend/internal/telemetry"

	"github.com/palyndav/my-backend/internal/games/reaction/results"
	// "github.com/palyndav/my-backend/internal/games/reaction/stats"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		log.Printf("api: %v", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	if len(os.Args) > 1 {
		if len(os.Args) != 2 || os.Args[1] != "healthcheck" {
			return fmt.Errorf("usage: api [healthcheck]")
		}
		return checkHealth(context.Background(), fmt.Sprintf("http://127.0.0.1:%d/health/ready", cfg.BACKEND_PORT))
	}

	signalContext, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	startupContext, cancel := context.WithTimeout(signalContext, 10*time.Second)
	db, err := postgresql.Open(startupContext, cfg)
	cancel()
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	//todo
	logger := slog.Default()

	resultsRepository := results.NewPostgresRepository(db)
	//statsRepository := stats.NewRepository(db)
	resultsService := results.NewService(resultsRepository)
	// statsService := stats.NewService(statsRepository)
	resultsHandler := results.NewHandler(logger, resultsService)
	// statsHandler := stats.NewHandler(statsService)

	router := httpapi.NewRouter(cfg, db, resultsHandler, telemetry.Handler{Reader: telemetry.Reader{DB: db}})
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.BACKEND_PORT),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("api server listening", "address", listener.Addr().String())
	if err := httpapi.ServeUntilCancelled(signalContext, server, listener, 10*time.Second); err != nil {
		return err
	}
	logger.Info("api shutdown complete")
	return nil
}
