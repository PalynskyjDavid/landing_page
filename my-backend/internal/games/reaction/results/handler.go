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
	TotalRounds int     `json:"totalRounds"`
	Times       []int   `json:"times"`
	Missclicks  int     `json:"missclicks"`
	AverageMs   int     `json:"averageMs"`
	SessionID   *string `json:"sessionId,omitempty"`
}

type createResponse struct {
	ID        int64  `json:"id"`
	CreatedAt string `json:"createdAt"`
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

	//nolint:staticcheck // Keep the transport-to-service mapping explicit so the types can evolve independently.
	result, err := h.service.Create(r.Context(), CreateInput{
		TotalRounds: request.TotalRounds,
		Times:       request.Times,
		Missclicks:  request.Missclicks,
		AverageMs:   request.AverageMs,
		SessionID:   request.SessionID,
	})
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}

	httpapi.WriteJSON(w, http.StatusCreated, createResponse{
		ID:        result.ID,
		CreatedAt: result.CreatedAt.Format(time.RFC3339),
	})
}
