package telemetry

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/palyndav/my-backend/internal/apperror"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
)

type ReportReader interface {
	Read(context.Context, Options) (*Report, error)
}
type Handler struct{ Reader ReportReader }

func (h Handler) RegisterRoutes(r chi.Router) { r.Get("/system/statistics", h.ServeHTTP) }
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	options := Options{Period: r.URL.Query().Get("period"), Route: r.URL.Query().Get("route")}
	if options.Period == "" {
		options.Period = "24h"
	}
	if (options.Period != "1h" && options.Period != "24h" && options.Period != "7d") ||
		(options.Route != "" && !KnownRoute(options.Route)) {
		httpapi.WriteError(w, nil, apperror.BadRequest("telemetry_invalid_filter", "Use period 1h, 24h or 7d and a supported route.", nil))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	report, err := h.Reader.Read(ctx, options)
	if err != nil {
		httpapi.WriteError(w, nil, apperror.New(http.StatusServiceUnavailable, "telemetry_unavailable", "System statistics are temporarily unavailable.", nil))
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, report)
}
