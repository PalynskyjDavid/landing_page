package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"backend-go/internal/apperror"
)

type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func WriteJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if payload == nil {
		return
	}

	_ = json.NewEncoder(w).Encode(payload)
}

func WriteError(w http.ResponseWriter, logger *slog.Logger, err error) {
	appErr := apperror.From(err)
	if appErr == nil {
		appErr = apperror.Internal("internal_error", "Internal server error.", nil)
	}

	if appErr.Err != nil {
		logger.Error("request failed",
			slog.String("code", appErr.Code),
			slog.Int("status", appErr.Status),
			slog.String("error", appErr.Err.Error()),
		)
	}

	WriteJSON(w, appErr.Status, ErrorEnvelope{
		Error: ErrorBody{
			Code:    appErr.Code,
			Message: appErr.Message,
		},
	})
}
