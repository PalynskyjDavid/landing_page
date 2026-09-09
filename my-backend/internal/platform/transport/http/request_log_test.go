package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func TestRequestLogUsesRoutePatternsAndExcludesRequestSecrets(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	router := chi.NewRouter()
	router.Use(middleware.RequestID, requestLog)
	router.Post("/items/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusCreated) })
	request := httptest.NewRequest(http.MethodPost, "/items/PRIVATE_PATH?secret=PRIVATE_QUERY", strings.NewReader("PRIVATE_BODY"))
	request.Header.Set("Cookie", "player=PRIVATE_COOKIE")
	request.Header.Set("Authorization", "Bearer PRIVATE_TOKEN")
	request.Header.Set("X-Request-ID", "test-correlation")
	router.ServeHTTP(httptest.NewRecorder(), request)
	var entry map[string]any
	if err := json.Unmarshal(output.Bytes(), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["route"] != "/items/{id}" || entry["request_id"] != "test-correlation" || entry["status"] != float64(201) {
		t.Fatalf("incorrect metadata: %v", entry)
	}
	if strings.Contains(output.String(), "PRIVATE_") {
		t.Fatalf("request details leaked: %s", &output)
	}
	output.Reset()
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/PRIVATE_UNKNOWN", nil))
	if !strings.Contains(output.String(), `"route":"<unmatched>"`) || strings.Contains(output.String(), "PRIVATE_") {
		t.Fatalf("unknown route not grouped: %s", &output)
	}
}
