package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/palyndav/my-backend/internal/config"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Registrar interface {
	RegisterRoutes(r chi.Router)
}

// Add logger later
// Add recoverer for easier debugging
// Add timeout, throttle, check out limiter and other interesting capabilities
func NewRouter(cfg config.Config, registrars ...Registrar) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))

	// CORS origin for FE
	if cfg.CORS_ORIGIN != "" {
		router.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{cfg.CORS_ORIGIN},
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			AllowCredentials: true,
			MaxAge:           300,
		}))
	}

	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "my-backend",
		})
	})

	router.Group(func(apiRouter chi.Router) {
		apiRouter.Use(AnonymousPlayer(cfg.COOKIE_SECURE))
		for _, registrar := range registrars {
			registrar.RegisterRoutes(apiRouter)
		}
	})

	return router
}
