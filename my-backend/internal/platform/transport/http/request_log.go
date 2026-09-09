package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		defer func() {
			route := chi.RouteContext(r.Context()).RoutePattern()
			if route == "" {
				route = "<unmatched>"
			}
			requestID := middleware.GetReqID(r.Context())
			if len(requestID) > 128 {
				requestID = "<invalid>"
			}
			status := recorder.Status()
			if status == 0 {
				status = http.StatusOK
			}
			// Route patterns, not query strings, bodies, headers or player cookies.
			slog.Info("http_request", "request_id", requestID, "route", route,
				"method", r.Method, "status", status, "duration_ms", time.Since(started).Milliseconds())
		}()
		next.ServeHTTP(recorder, r)
	})
}
