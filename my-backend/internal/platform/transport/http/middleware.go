package httpapi

import (
	"net/http"
)

// Wraps http.ResponseWriter and adds a statusCode, default StatusOK 200,
// embedding / decorator / wrapper pattern - reuses ResponseWriter
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

// Override / rewrite WriteHeader function for custom behaviour - set status code + call original WriteHeader
func (r *statusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

