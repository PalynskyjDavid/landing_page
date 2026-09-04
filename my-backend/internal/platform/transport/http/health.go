package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

const readinessTimeout = time.Second

type ReadinessChecker interface {
	Ping(context.Context) error
}

type healthHandler struct {
	readinessChecker ReadinessChecker
}

func newHealthHandler(readinessChecker ReadinessChecker) healthHandler {
	return healthHandler{readinessChecker: readinessChecker}
}

func (h healthHandler) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "alive",
		"service": "my-backend",
	})
}

func (h healthHandler) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), readinessTimeout)
	defer cancel()

	if h.readinessChecker == nil || h.readinessChecker.Ping(ctx) != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status": "not_ready",
			"dependencies": map[string]string{
				"database": "unavailable",
			},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ready",
		"dependencies": map[string]string{
			"database": "available",
		},
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
