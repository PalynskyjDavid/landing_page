package results

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
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
	SubmissionID string  `json:"submissionId"`
	Times        []int   `json:"times"`
	Missclicks   int     `json:"missclicks"`
	DisplayName  *string `json:"displayName,omitempty"`
	DeviceType   string  `json:"deviceType"`
}

type createResponse struct {
	ID           int64   `json:"id"`
	SubmissionID string  `json:"submissionId"`
	TotalRounds  int     `json:"totalRounds"`
	AverageMs    int     `json:"averageMs"`
	DisplayName  *string `json:"displayName,omitempty"`
	DeviceType   string  `json:"deviceType"`
	CreatedAt    string  `json:"createdAt"`
}

type leaderboardResponse struct {
	Entries []LeaderboardEntry `json:"entries"`
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{
		logger:  logger,
		service: service,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/scores", h.handleCreate)
	r.Get("/scores/leaderboard", h.handleLeaderboard)
	r.Get("/scores/statistics", h.handleStatistics)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	var request createRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			httpapi.WriteError(w, h.logger, apperror.New(http.StatusRequestEntityTooLarge, "request_too_large", "Score requests must not exceed 8 KiB.", err))
			return
		}
		httpapi.WriteError(w, h.logger, apperror.BadRequest("invalid_json", "Invalid JSON body.", err))
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			httpapi.WriteError(w, h.logger, apperror.New(http.StatusRequestEntityTooLarge, "request_too_large", "Score requests must not exceed 8 KiB.", err))
		} else {
			httpapi.WriteError(w, h.logger, apperror.BadRequest("invalid_json", "Send exactly one JSON object.", err))
		}
		return
	}

	playerID, ok := httpapi.PlayerIDFromContext(r.Context())
	if !ok {
		httpapi.WriteError(w, h.logger, apperror.Internal("player_identity_missing", "Failed to identify player.", nil))
		return
	}

	if !httpapi.PlayerCookieEstablished(r.Context()) {
		httpapi.WriteError(w, h.logger, apperror.BadRequest(
			"score_player_cookie_required",
			"Allow the player cookie, then retry the same score submission.",
			nil,
		))
		return
	}

	result, created, err := h.service.Create(r.Context(), CreateInput{
		SubmissionID: request.SubmissionID,
		PlayerID:     playerID,
		Times:        request.Times,
		Missclicks:   request.Missclicks,
		DisplayName:  request.DisplayName,
		DeviceType:   request.DeviceType,
	})
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}

	statusCode := http.StatusOK
	if created {
		statusCode = http.StatusCreated
	}

	httpapi.WriteJSON(w, statusCode, createResponse{
		ID:           result.ID,
		SubmissionID: result.SubmissionID,
		TotalRounds:  result.TotalRounds,
		AverageMs:    result.AverageMs,
		DisplayName:  result.DisplayName,
		DeviceType:   defaultDeviceType(result.DeviceType),
		CreatedAt:    result.CreatedAt.Format(time.RFC3339),
	})
}

func (h *Handler) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	options, err := parseLeaderboardOptions(r)
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}
	entries, err := h.service.Leaderboard(r.Context(), options)
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, leaderboardResponse{Entries: entries})
}

func (h *Handler) handleStatistics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	options, err := parseStatisticsOptions(r)
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}
	playerID, _ := httpapi.PlayerIDFromContext(r.Context())
	options.PlayerID = playerID
	result, err := h.service.Statistics(r.Context(), options)
	if err != nil {
		httpapi.WriteError(w, h.logger, err)
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, result)
}

func parseLeaderboardOptions(r *http.Request) (LeaderboardOptions, error) {
	options := LeaderboardOptions{}
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 1 || parsedLimit > maxLeaderboardLimit {
			return options, apperror.BadRequest("score_invalid_limit", "limit must be between 1 and 50.", err)
		}
		options.Limit = parsedLimit
	}

	if rawSort := r.URL.Query().Get("sort"); rawSort != "" {
		for _, rawSelection := range strings.Split(rawSort, ",") {
			parts := strings.SplitN(strings.TrimSpace(rawSelection), ":", 2)
			selection := LeaderboardSort{
				Field:     LeaderboardSortField(parts[0]),
				Direction: leaderboardSortBest,
			}
			if len(parts) == 2 {
				selection.Direction = LeaderboardSortDirection(parts[1])
			}
			options.Sort = append(options.Sort, selection)
		}
	}

	return options, nil
}
