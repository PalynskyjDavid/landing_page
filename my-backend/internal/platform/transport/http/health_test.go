package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/palyndav/my-backend/internal/config"
)

type fakeReadinessChecker struct {
	err error
}

func (f fakeReadinessChecker) Ping(context.Context) error {
	return f.err
}

func TestHealthLivenessDoesNotDependOnDatabase(t *testing.T) {
	router := NewRouter(testConfig(), fakeReadinessChecker{err: errors.New("database unavailable")})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health/live", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("expected health response not to be cached")
	}
	if !strings.Contains(response.Body.String(), `"status":"alive"`) {
		t.Fatalf("expected alive response, got %s", response.Body.String())
	}
}

func TestHealthReadinessReportsAvailableDatabase(t *testing.T) {
	router := NewRouter(testConfig(), fakeReadinessChecker{})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health/ready", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !strings.Contains(response.Body.String(), `"database":"available"`) {
		t.Fatalf("expected available database response, got %s", response.Body.String())
	}
}

func TestHealthReadinessDoesNotExposeDatabaseError(t *testing.T) {
	const internalError = "password authentication failed for secret-user"
	router := NewRouter(testConfig(), fakeReadinessChecker{err: errors.New(internalError)})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health/ready", nil))

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}
	if !strings.Contains(response.Body.String(), `"database":"unavailable"`) {
		t.Fatalf("expected unavailable database response, got %s", response.Body.String())
	}
	if strings.Contains(response.Body.String(), internalError) {
		t.Fatalf("response exposed internal error: %s", response.Body.String())
	}
}

func testConfig() config.Config {
	return config.Config{}
}
