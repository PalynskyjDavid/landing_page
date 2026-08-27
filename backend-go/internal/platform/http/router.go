package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"backend-go/internal/config"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Registrar interface {
	RegisterRoutes(r chi.Router)
}

func NewRouter(cfg config.Config, logger *slog.Logger, registrars ...Registrar) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(RequestLogger(logger))
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))

	if cfg.CORSOrigin != "" {
		router.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{cfg.CORSOrigin},
			AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "backend-go",
		})
	})

	for _, registrar := range registrars {
		registrar.RegisterRoutes(router)
	}

	return router
}
