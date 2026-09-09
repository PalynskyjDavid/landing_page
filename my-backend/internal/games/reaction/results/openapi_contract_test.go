package results

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/legacy"
	"github.com/go-chi/chi/v5"
	"github.com/palyndav/my-backend/internal/config"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
	"github.com/palyndav/my-backend/internal/telemetry"
)

func loadOpenAPI(t *testing.T) (*openapi3.T, routers.Router) {
	t.Helper()
	loader := openapi3.NewLoader()
	// Relative to this package, not the shell's working directory. External refs
	// remain disabled: checking this contract must not fetch remote documents.
	document, err := loader.LoadFromFile("../../../../../docs/contracts/openapi.yaml")
	if err != nil {
		t.Fatalf("load OpenAPI: %v", err)
	}
	router, err := legacy.NewRouter(document) // Also validates the document and its examples.
	if err != nil {
		t.Fatalf("validate OpenAPI: %v", err)
	}
	return document, router
}

type contractReadiness struct{ err error }

type contractTelemetry struct{ err error }

func (c contractTelemetry) Read(context.Context, telemetry.Options) (*telemetry.Report, error) {
	return &telemetry.Report{Source: "nginx", GeneratedAt: time.Date(2026, 9, 9, 0, 0, 0, 0, time.UTC), Points: []telemetry.Point{}}, c.err
}

func (c contractReadiness) Ping(context.Context) error { return c.err }

func TestOpenAPIRoutesMatchApplication(t *testing.T) {
	document, _ := loadOpenAPI(t)
	documented := map[string]bool{}
	for path, item := range document.Paths.Map() {
		for method := range item.Operations() {
			documented[method+" "+path] = true
		}
	}
	handler := httpapi.NewRouter(config.Config{}, contractReadiness{}, NewHandler(nil, NewService(&fakeRepository{})), telemetry.Handler{Reader: contractTelemetry{}})
	actual := map[string]bool{}
	routes, ok := handler.(chi.Routes)
	if !ok {
		t.Fatal("application router does not expose its routes")
	}
	err := chi.Walk(routes, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		actual[method+" "+route] = true
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(documented, actual) {
		t.Fatalf("OpenAPI routes = %v; application routes = %v", documented, actual)
	}
}

func TestOpenAPIHTTPResponses(t *testing.T) {
	document, contractRouter := loadOpenAPI(t)
	createdAt := time.Date(2026, time.September, 8, 0, 0, 0, 0, time.UTC)
	const validBody = `{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[241,228,255,249,235],"missclicks":0}`
	existing := &Result{
		ID: 1, SubmissionID: testSubmissionID, PlayerID: testPlayerID,
		Times: []int{241, 228, 255, 249, 235}, TotalRounds: 5, AverageMs: 241, CreatedAt: createdAt,
	}
	tests := []struct {
		name         string
		target       string
		body         string // A nonempty body selects POST; other cases use GET.
		status       int
		code         string
		repo         fakeRepository
		healthErr    error
		telemetryErr error
		noCookie     bool
	}{
		{name: "health alias", target: "/health", status: 200},
		{name: "system statistics", target: "/system/statistics?period=1h", status: 200},
		{name: "invalid system filter", target: "/system/statistics?period=bad", status: 400, code: "telemetry_invalid_filter"},
		{name: "system statistics unavailable", target: "/system/statistics", status: 503, code: "telemetry_unavailable", telemetryErr: errors.New("private storage failure")},
		{name: "liveness", target: "/health/live", status: 200},
		{name: "readiness", target: "/health/ready", status: 200},
		{name: "database unavailable", target: "/health/ready", status: 503, healthErr: errors.New("offline")},
		{name: "anonymous score", target: "/scores", body: validBody, status: 201},
		{name: "cookie handshake", target: "/scores", body: validBody, status: 400, code: "score_player_cookie_required", noCookie: true},
		{name: "trimmed name", target: "/scores", body: strings.Replace(validBody, `"missclicks":0`, `"missclicks":0,"displayName":"  David  "`, 1), status: 201},
		{name: "optional missclicks", target: "/scores", body: strings.Replace(validBody, `,"missclicks":0`, "", 1), status: 201},
		{name: "null optional fields", target: "/scores", body: strings.Replace(validBody, `"missclicks":0`, `"missclicks":null,"displayName":null`, 1), status: 201},
		{name: "identical replay", target: "/scores", body: validBody, status: 200, repo: fakeRepository{existingResult: existing}},
		{name: "changed replay", target: "/scores", body: strings.Replace(validBody, "[241,", "[300,", 1), status: 409, code: "score_submission_conflict", repo: fakeRepository{existingResult: existing}},
		{name: "invalid JSON", target: "/scores", body: "{", status: 400, code: "invalid_json"},
		{name: "unknown property", target: "/scores", body: strings.Replace(validBody, `"missclicks":0`, `"averageMs":1`, 1), status: 400, code: "invalid_json"},
		{name: "missing UUID", target: "/scores", body: `{"times":[1,2,3,4,5]}`, status: 400, code: "score_invalid_submission_id"},
		{name: "invalid UUID", target: "/scores", body: strings.Replace(validBody, testSubmissionID, "invalid", 1), status: 400, code: "score_invalid_submission_id"},
		{name: "short game", target: "/scores", body: strings.Replace(validBody, "[241,228,255,249,235]", "[1,2]", 1), status: 400, code: "score_invalid_round_count"},
		{name: "nonpositive time", target: "/scores", body: strings.Replace(validBody, "[241,", "[0,", 1), status: 400, code: "score_invalid_time"},
		{name: "negative missclicks", target: "/scores", body: strings.Replace(validBody, `"missclicks":0`, `"missclicks":-1`, 1), status: 400, code: "score_invalid_missclicks"},
		{name: "long name", target: "/scores", body: strings.Replace(validBody, `"missclicks":0`, `"displayName":"1234567890123456789012345"`, 1), status: 400, code: "score_display_name_too_long"},
		{name: "write unavailable", target: "/scores", body: validBody, status: 500, code: "internal_error", repo: fakeRepository{err: errors.New("offline")}},
		{name: "empty leaderboard", target: "/scores/leaderboard", status: 200},
		{name: "empty statistics", target: "/scores/statistics", status: 200},
		{name: "grouped statistics", target: "/scores/statistics?group=players&scope=mine&period=7d&minGames=2&maxAverageMs=500", status: 200},
		{name: "invalid statistics filter", target: "/scores/statistics?minAverageMs=500&maxAverageMs=100", status: 400, code: "score_invalid_filter"},
		{name: "statistics unavailable", target: "/scores/statistics", status: 500, code: "internal_error", repo: fakeRepository{leaderboardErr: errors.New("offline")}},
		{name: "oversized JSON", target: "/scores", body: `{"displayName":"` + strings.Repeat("x", 9000) + `"}`, status: 413, code: "request_too_large"},
		{name: "leaderboard entries", target: "/scores/leaderboard?limit=5&sort=bestMs:worst,missclicks:best", status: 200, repo: fakeRepository{entries: []LeaderboardEntry{
			{Rank: 1, ScoreID: 1, AverageMs: 241, BestMs: 228, TotalRounds: 5, CreatedAt: createdAt},
		}}},
		{name: "zero limit", target: "/scores/leaderboard?limit=0", status: 400, code: "score_invalid_limit"},
		{name: "negative limit", target: "/scores/leaderboard?limit=-1", status: 400, code: "score_invalid_limit"},
		{name: "large limit", target: "/scores/leaderboard?limit=51", status: 400, code: "score_invalid_limit"},
		{name: "nonnumeric limit", target: "/scores/leaderboard?limit=many", status: 400, code: "score_invalid_limit"},
		{name: "duplicate sort", target: "/scores/leaderboard?sort=bestMs:best,bestMs:worst", status: 400, code: "score_invalid_sort"},
		{name: "read unavailable", target: "/scores/leaderboard", status: 500, code: "internal_error", repo: fakeRepository{leaderboardErr: errors.New("offline")}},
	}
	covered := map[string]bool{}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			method := http.MethodGet
			if tc.body != "" {
				method = http.MethodPost
			}
			newRequest := func() *http.Request {
				request := httptest.NewRequest(method, tc.target, strings.NewReader(tc.body))
				if tc.body != "" {
					request.Header.Set("Content-Type", "application/json")
				}
				if !tc.noCookie {
					request.AddCookie(&http.Cookie{Name: httpapi.AnonymousPlayerCookieName, Value: testPlayerID})
				}
				return request
			}
			// Validate a separate request: schema defaults/body decoding must never
			// change the request that our real handler receives.
			request := newRequest()
			route, pathParams, err := contractRouter.FindRoute(request)
			if err != nil {
				t.Fatal(err)
			}
			input := &openapi3filter.RequestValidationInput{Request: request, Route: route, PathParams: pathParams}
			if tc.status != http.StatusBadRequest && tc.status != http.StatusRequestEntityTooLarge {
				if err := openapi3filter.ValidateRequest(t.Context(), input); err != nil {
					t.Fatalf("valid request violates contract: %v", err)
				}
			}
			tc.repo.createdAt = createdAt
			handler := httpapi.NewRouter(config.Config{}, contractReadiness{tc.healthErr}, NewHandler(nil, NewService(&tc.repo)), telemetry.Handler{Reader: contractTelemetry{tc.telemetryErr}})
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, newRequest())
			if response.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.status, response.Body.String())
			}
			output := &openapi3filter.ResponseValidationInput{
				RequestValidationInput: input, Status: response.Code, Header: response.Header(),
				Options: &openapi3filter.Options{IncludeResponseStatus: true},
			}
			if err := openapi3filter.ValidateResponse(t.Context(), output.SetBodyBytes(response.Body.Bytes())); err != nil {
				t.Fatalf("handler response violates contract: %v", err)
			}
			if tc.code != "" {
				var envelope httpapi.ErrorEnvelope
				if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
					t.Fatal(err)
				}
				if envelope.Error.Code != tc.code {
					t.Fatalf("error code = %s, want %s", envelope.Error.Code, tc.code)
				}
			}
			covered[method+" "+route.Path+" "+strconv.Itoa(tc.status)] = true
		})
	}
	// Every declared status needs at least one real-handler example.
	for path, item := range document.Paths.Map() {
		for method, operation := range item.Operations() {
			for status := range operation.Responses.Map() {
				// These originate in NGINX and are exercised in proxy E2E tests.
				if operation.Responses.Value(status).Value.Extensions["x-edge-response"] == true {
					continue
				}
				if key := method + " " + path + " " + status; !covered[key] {
					t.Errorf("missing HTTP contract example: %s", key)
				}
			}
		}
	}
}

func TestOpenAPIRejectsInvalidScoreShapes(t *testing.T) {
	document, _ := loadOpenAPI(t)
	schema := document.Components.Schemas["CreateScore"].Value
	for _, body := range []string{
		`{}`,
		`{"submissionId":"invalid","times":[1,2,3,4,5]}`,
		`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[1,2]}`,
		`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[0,2,3,4,5]}`,
		`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[1,2,3,4,5],"averageMs":1}`,
	} {
		var value any
		if err := json.Unmarshal([]byte(body), &value); err != nil {
			t.Fatal(err)
		}
		if err := schema.VisitJSON(value); err == nil {
			t.Errorf("contract accepted invalid score: %s", body)
		}
	}
}

func TestOpenAPIDetectsResponseDrift(t *testing.T) {
	document, _ := loadOpenAPI(t)
	schema := document.Components.Schemas["SavedScore"].Value
	for _, change := range []struct {
		name   string
		mutate func(map[string]any)
	}{
		{"ID changed to string", func(body map[string]any) { body["id"] = "1" }},
		{"required timestamp removed", func(body map[string]any) { delete(body, "createdAt") }},
		{"null instead of omitted name", func(body map[string]any) { body["displayName"] = nil }},
	} {
		t.Run(change.name, func(t *testing.T) {
			body := map[string]any{
				"id": float64(1), "submissionId": testSubmissionID, "totalRounds": float64(5),
				"averageMs": float64(241), "createdAt": "2026-09-08T00:00:00Z",
			}
			if err := schema.VisitJSON(body); err != nil {
				t.Fatalf("valid control response rejected: %v", err)
			}
			change.mutate(body)
			if err := schema.VisitJSON(body); err == nil {
				t.Fatal("contract did not catch the response drift")
			}
		})
	}
}
