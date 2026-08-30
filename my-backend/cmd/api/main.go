package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/palyndav/my-backend/internal/config"
	"github.com/palyndav/my-backend/internal/database/postgresql"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"

	"github.com/palyndav/my-backend/internal/games/reaction/results"
	// "github.com/palyndav/my-backend/internal/games/reaction/stats"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := postgresql.Open(context.Background(), cfg)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	//todo
	logger := slog.Default()

	resultsRepository := results.NewRepository(db)
	//statsRepository := stats.NewRepository(db)
	resultsService := results.NewService(resultsRepository)
	// statsService := stats.NewService(statsRepository)
	resultsHandler := results.NewHandler(logger, resultsService)
	// statsHandler := stats.NewHandler(statsService)

	router := httpapi.NewRouter(cfg, resultsHandler)
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.BACKEND_PORT),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("api server listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen and serve: %v", err)
		}
	}()

	signalContext, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-signalContext.Done()

	shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownContext); err != nil {
		log.Fatalf("shutdown server: %v", err)
	}
}
