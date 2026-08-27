package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"backend-go/internal/config"
	"backend-go/internal/database/postgres"
	"backend-go/internal/reaction/stats"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	logger := config.NewLogger(cfg.LogLevel)
	db, err := postgres.Open(context.Background(), cfg)
	if err != nil {
		logger.Error("open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	statsRepository := stats.NewRepository(db)
	statsService := stats.NewService(statsRepository)
	runner := stats.NewWorker(logger, statsService, cfg.StatsUpdateInterval)

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger.Info("worker started", "interval_seconds", cfg.StatsUpdateIntervalSeconds)
	if err := runner.Run(signalContext); err != nil {
		logger.Error("worker stopped", "error", err)
		os.Exit(1)
	}
}
