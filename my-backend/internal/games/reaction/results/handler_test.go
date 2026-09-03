package results

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHandleCreateReturnsServerDerivedValues(t *testing.T) {
	createdAt := time.Date(2026, time.September, 3, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{createdAt: createdAt}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"times":[241,228,255,249,235],"missclicks":1,"displayName":"  David  "}`),
	)
	response := httptest.NewRecorder()

	handler.handleCreate(response, request)

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

func TestHandleCreateRejectsClientCalculatedAverage(t *testing.T) {
	repo := &fakeRepository{}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(
		http.MethodPost,
		"/scores",
		strings.NewReader(`{"times":[241,228,255,249,235],"missclicks":1,"averageMs":1}`),
	)
	response := httptest.NewRecorder()

	handler.handleCreate(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if repo.createCalls != 0 {
		t.Fatalf("expected repository not to be called, got %d calls", repo.createCalls)
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
