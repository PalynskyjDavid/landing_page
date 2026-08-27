package stats

import (
	"log/slog"
	"net/http"

	httpapi "backend-go/internal/platform/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	logger  *slog.Logger
	service *Service
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{
		logger:  logger,
		service: service,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/stats/summary", h.handleGetSummary)
}

func (h *Handler) handleGetSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetSummary(r.Context())
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}

	httpapi.WriteJSON(w, http.StatusOK, summary)
}
