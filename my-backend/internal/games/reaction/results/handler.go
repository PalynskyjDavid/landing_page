package results

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/palyndav/my-backend/internal/apperror"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	logger  *slog.Logger
	service *Service
}

type createRequest struct {
	Times       []int   `json:"times"`
	Missclicks  int     `json:"missclicks"`
	SessionID   *string `json:"sessionId,omitempty"`
	DisplayName *string `json:"displayName,omitempty"`
}

type createResponse struct {
	ID          int64   `json:"id"`
	TotalRounds int     `json:"totalRounds"`
	AverageMs   int     `json:"averageMs"`
	DisplayName *string `json:"displayName,omitempty"`
	CreatedAt   string  `json:"createdAt"`
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{
		logger:  logger,
		service: service,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/scores", h.handleCreate)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var request createRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		httpapi.WriteError(w, h.logger, apperror.BadRequest("invalid_json", "Invalid JSON body.", err))
		return
	}

	result, err := h.service.Create(r.Context(), CreateInput(request))
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}

	httpapi.WriteJSON(w, http.StatusCreated, createResponse{
		ID:          result.ID,
		TotalRounds: result.TotalRounds,
		AverageMs:   result.AverageMs,
		DisplayName: result.DisplayName,
		CreatedAt:   result.CreatedAt.Format(time.RFC3339),
	})
}
