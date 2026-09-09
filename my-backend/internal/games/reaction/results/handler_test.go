package results

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
)

func serveCreateAsTestPlayer(handler *Handler, response *httptest.ResponseRecorder, request *http.Request) {
	request.AddCookie(&http.Cookie{Name: httpapi.AnonymousPlayerCookieName, Value: testPlayerID})
	httpapi.AnonymousPlayer(false)(http.HandlerFunc(handler.handleCreate)).ServeHTTP(response, request)
}

func TestHandleCreateReturnsServerDerivedValues(t *testing.T) {
	createdAt := time.Date(2026, time.September, 3, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{createdAt: createdAt}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[241,228,255,249,235],"missclicks":1,"displayName":"  David  "}`),
	)
	response := httptest.NewRecorder()

	serveCreateAsTestPlayer(handler, response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, response.Code, response.Body.String())
	}

	var body createResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.ID != 1 {
		t.Fatalf("expected id 1, got %d", body.ID)
	}
	if body.SubmissionID != testSubmissionID {
		t.Fatalf("expected submission ID %q, got %q", testSubmissionID, body.SubmissionID)
	}
	if body.TotalRounds != requiredRoundCount {
		t.Fatalf("expected %d rounds, got %d", requiredRoundCount, body.TotalRounds)
	}
	if body.AverageMs != 241 {
		t.Fatalf("expected server average 241, got %d", body.AverageMs)
	}
	if body.DisplayName == nil || *body.DisplayName != "David" {
		t.Fatalf("expected normalized display name David, got %#v", body.DisplayName)
	}
	if body.CreatedAt != createdAt.Format(time.RFC3339) {
		t.Fatalf("expected createdAt %q, got %q", createdAt.Format(time.RFC3339), body.CreatedAt)
	}
}

func TestHandleCreateRejectsExtraOrOversizedJSONBeforeWriting(t *testing.T) {
	const valid = `{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[1,2,3,4,5]}`
	for _, test := range []struct {
		name   string
		body   string
		status int
		code   string
	}{
		{"second object", valid + `{}`, http.StatusBadRequest, "invalid_json"},
		{"trailing garbage", valid + `invalid`, http.StatusBadRequest, "invalid_json"},
		{"oversized JSON", `{"displayName":"` + strings.Repeat("a", 9000) + `"}`, http.StatusRequestEntityTooLarge, "request_too_large"},
		{"oversized trailing whitespace", valid + strings.Repeat(" ", 9000), http.StatusRequestEntityTooLarge, "request_too_large"},
	} {
		t.Run(test.name, func(t *testing.T) {
			repo := &fakeRepository{}
			handler := NewHandler(nil, NewService(repo))
			request := httptest.NewRequest(http.MethodPost, "/scores", strings.NewReader(test.body))
			response := httptest.NewRecorder()
			serveCreateAsTestPlayer(handler, response, request)
			if response.Code != test.status || repo.createCalls != 0 {
				t.Fatalf("status=%d writes=%d body=%s", response.Code, repo.createCalls, response.Body.String())
			}
			var envelope httpapi.ErrorEnvelope
			if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
				t.Fatal(err)
			}
			if envelope.Error.Code != test.code {
				t.Fatalf("error code=%q, want %q", envelope.Error.Code, test.code)
			}
		})
	}
}

func TestHandleCreateRequiresCookieBeforeWriting(t *testing.T) {
	for _, rawCookie := range []string{"", "invalid-cookie"} {
		t.Run("incoming cookie: "+rawCookie, func(t *testing.T) {
			repo := &fakeRepository{}
			handler := NewHandler(nil, NewService(repo))
			api := httpapi.AnonymousPlayer(false)(http.HandlerFunc(handler.handleCreate))
			const body = `{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[1,2,3,4,5]}`
			var cookie *http.Cookie
			// Losing the cookie-only response is safe: repeated cookieless calls
			// must never reach the repository.
			for range 2 {
				request := httptest.NewRequest(http.MethodPost, "/scores", strings.NewReader(body))
				if rawCookie != "" {
					request.AddCookie(&http.Cookie{Name: httpapi.AnonymousPlayerCookieName, Value: rawCookie})
				}
				response := httptest.NewRecorder()
				api.ServeHTTP(response, request)
				if response.Code != http.StatusBadRequest || repo.createCalls != 0 {
					t.Fatalf("cookie must be established before writing: status=%d writes=%d", response.Code, repo.createCalls)
				}
				var envelope httpapi.ErrorEnvelope
				if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
					t.Fatal(err)
				}
				if envelope.Error.Code != "score_player_cookie_required" {
					t.Fatalf("unexpected error: %#v", envelope)
				}
				cookies := response.Result().Cookies()
				if len(cookies) != 1 {
					t.Fatal("expected a replacement player cookie")
				}
				cookie = cookies[0]
			}
			request := httptest.NewRequest(http.MethodPost, "/scores", strings.NewReader(body))
			request.AddCookie(cookie)
			response := httptest.NewRecorder()
			api.ServeHTTP(response, request)
			if response.Code != http.StatusCreated || repo.createCalls != 1 {
				t.Fatalf("established cookie should allow one write: status=%d writes=%d", response.Code, repo.createCalls)
			}
		})
	}
}

func TestHandleCreateRejectsClientCalculatedAverage(t *testing.T) {
	repo := &fakeRepository{}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"times":[241,228,255,249,235],"missclicks":1,"averageMs":1}`),
	)
	response := httptest.NewRecorder()

	serveCreateAsTestPlayer(handler, response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if repo.createCalls != 0 {
		t.Fatalf("expected repository not to be called, got %d calls", repo.createCalls)
	}
}

func TestHandleCreateReturnsExistingSubmission(t *testing.T) {
	createdAt := time.Date(2026, time.September, 3, 12, 0, 0, 0, time.UTC)
	displayName := "David"
	repo := &fakeRepository{existingResult: &Result{
		ID:           42,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		AverageMs:    241,
		DisplayName:  &displayName,
		CreatedAt:    createdAt,
	}}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[241,228,255,249,235],"missclicks":1,"displayName":"David"}`),
	)
	response := httptest.NewRecorder()

	serveCreateAsTestPlayer(handler, response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
}

func TestHandleCreateReturnsConflictForChangedDuplicate(t *testing.T) {
	repo := &fakeRepository{existingResult: &Result{
		ID:           42,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		AverageMs:    241,
	}}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"submissionId":"550e8400-e29b-41d4-a716-446655440000","times":[300,228,255,249,235],"missclicks":0}`),
	)
	response := httptest.NewRecorder()

	serveCreateAsTestPlayer(handler, response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d: %s", http.StatusConflict, response.Code, response.Body.String())
	}
}

func TestHandleLeaderboardReturnsEntries(t *testing.T) {
	displayName := "David"
	createdAt := time.Date(2026, time.September, 3, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{entries: []LeaderboardEntry{{
		Rank:        1,
		ScoreID:     42,
		DisplayName: &displayName,
		AverageMs:   241,
		BestMs:      228,
		TotalRounds: requiredRoundCount,
		Missclicks:  1,
		CreatedAt:   createdAt,
	}}}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(http.MethodGet, "/scores/leaderboard?limit=5&sort=bestMs:worst,missclicks:best", nil)
	response := httptest.NewRecorder()

	handler.handleLeaderboard(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
	if repo.gotLeaderboardParams.Limit != 5 {
		t.Fatalf("expected limit 5, got %d", repo.gotLeaderboardParams.Limit)
	}
	wantPrimary := LeaderboardSort{Field: leaderboardSortBestMs, Direction: leaderboardSortWorst}
	wantSecondary := LeaderboardSort{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest}
	if repo.gotLeaderboardParams.PrimarySort != wantPrimary || repo.gotLeaderboardParams.SecondarySort != wantSecondary {
		t.Fatalf("unexpected sort parameters: %#v", repo.gotLeaderboardParams)
	}

	var body leaderboardResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Entries) != 1 || body.Entries[0].ScoreID != 42 {
		t.Fatalf("unexpected response entries: %#v", body.Entries)
	}
}

func TestHandleLeaderboardRejectsInvalidSort(t *testing.T) {
	repo := &fakeRepository{}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(http.MethodGet, "/scores/leaderboard?sort=bestMs:best,bestMs:worst", nil)
	response := httptest.NewRecorder()

	handler.handleLeaderboard(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if repo.leaderboardCalls != 0 {
		t.Fatalf("expected repository not to be called, got %d calls", repo.leaderboardCalls)
	}
}

func TestHandleLeaderboardRejectsNonNumericLimit(t *testing.T) {
	repo := &fakeRepository{}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(http.MethodGet, "/scores/leaderboard?limit=many", nil)
	response := httptest.NewRecorder()

	handler.handleLeaderboard(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if repo.leaderboardCalls != 0 {
		t.Fatalf("expected repository not to be called, got %d calls", repo.leaderboardCalls)
	}
}
