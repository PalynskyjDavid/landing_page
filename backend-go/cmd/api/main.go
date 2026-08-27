package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"backend-go/internal/config"
	"backend-go/internal/database/postgres"
	httpapi "backend-go/internal/platform/http"
	"backend-go/internal/reaction/results"
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

	resultRepository := results.NewRepository(db)
	statsRepository := stats.NewRepository(db)
	resultService := results.NewService(resultRepository)
	statsService := stats.NewService(statsRepository)
	resultHandler := results.NewHandler(logger, resultService)
	statsHandler := stats.NewHandler(logger, statsService)

	router := httpapi.NewRouter(
		cfg,
		logger,
		resultHandler,
		statsHandler,
	)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.APIPort),
		Handler: router,
	}

	go func() {
		logger.Info("api server listening", "port", cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("api server stopped", "error", err)
			os.Exit(1)
		}
	}()

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	<-signalContext.Done()
	logger.Info("api shutdown started")

	shutdownContext, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownContext); err != nil {
		logger.Error("api shutdown failed", "error", err)
		os.Exit(1)
	}
}
