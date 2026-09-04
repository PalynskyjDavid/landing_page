package httpapi

import (
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
func NewRouter(cfg config.Config, readinessChecker ReadinessChecker, registrars ...Registrar) http.Handler {
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

	health := newHealthHandler(readinessChecker)
	router.Get("/health", health.live)
	router.Get("/health/live", health.live)
	router.Get("/health/ready", health.ready)

	router.Group(func(apiRouter chi.Router) {
		apiRouter.Use(AnonymousPlayer(cfg.COOKIE_SECURE))
		for _, registrar := range registrars {
			registrar.RegisterRoutes(apiRouter)
		}
	})

	return router
}
