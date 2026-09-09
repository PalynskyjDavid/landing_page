package results

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
)

func statisticsInt(value int) *int { return &value }

func TestStatisticsValidatesFiltersBeforeQuerying(t *testing.T) {
	tests := []struct {
		name    string
		options StatisticsOptions
	}{
		{"scope", StatisticsOptions{Scope: "someone"}},
		{"period", StatisticsOptions{Period: "forever"}},
		{"group", StatisticsOptions{Group: "ip"}},
		{"cookie", StatisticsOptions{Scope: "mine", PlayerID: "not-a-uuid"}},
		{"range", StatisticsOptions{MinAverageMs: statisticsInt(400), MaxAverageMs: statisticsInt(100)}},
		{"negative", StatisticsOptions{MinMissclicks: statisticsInt(-1)}},
		{"huge", StatisticsOptions{MaxBestMs: statisticsInt(2147483648)}},
		{"name", StatisticsOptions{Player: strings.Repeat("x", 25)}},
		{"minimum games", StatisticsOptions{MinGames: 2}},
		{"sort injection", StatisticsOptions{LeaderboardOptions: LeaderboardOptions{Sort: []LeaderboardSort{{Field: "average_ms;DROP TABLE scores", Direction: leaderboardSortBest}}}}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepository{}
			if _, err := NewService(repo).Statistics(t.Context(), tc.options); err == nil {
				t.Fatal("invalid filter accepted")
			}
			if repo.statisticsCalls != 0 {
				t.Fatal("invalid filters reached storage")
			}
		})
	}
}

func TestStatisticsMapsMinePeriodAndGrouping(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	_, err := service.Statistics(t.Context(), StatisticsOptions{
		Scope: "mine", PlayerID: testPlayerID, Period: "7d", Group: "players",
		MinGames: 2, Player: " Alice ", MaxAverageMs: statisticsInt(500),
	})
	if err != nil {
		t.Fatal(err)
	}
	got := repo.statisticsParams
	if got.Limit != 10 || got.PlayerID != testPlayerID || got.Group != "players" || got.Player != "Alice" || got.MinGames != 2 ||
		got.Since == nil || !got.Since.Equal(now.Add(-7*24*time.Hour)) || *got.MaxAverageMs != 500 {
		t.Fatalf("unexpected parameters: %#v", got)
	}
	from, to := now, now.Add(-time.Hour)
	if _, err := service.Statistics(t.Context(), StatisticsOptions{From: &from, To: &to}); err == nil {
		t.Fatal("reversed dates accepted")
	}
	if _, err := service.Statistics(t.Context(), StatisticsOptions{Period: "7d", From: &from}); err == nil {
		t.Fatal("ambiguous period accepted")
	}
}

func TestStatisticsParsesFiltersAndDoesNotExposePlayerID(t *testing.T) {
	repo := &fakeRepository{}
	handler := NewHandler(nil, NewService(repo))
	request := httptest.NewRequest(http.MethodGet, "/scores/statistics?group=players&scope=mine&minGames=2&minBestMs=100&to=2026-09-10T00:00:00Z", nil)
	request.AddCookie(&http.Cookie{Name: httpapi.AnonymousPlayerCookieName, Value: testPlayerID})
	response := httptest.NewRecorder()
	httpapi.AnonymousPlayer(false)(http.HandlerFunc(handler.handleStatistics)).ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	if repo.statisticsParams.PlayerID != testPlayerID || repo.statisticsParams.Until == nil || *repo.statisticsParams.MinBestMs != 100 {
		t.Fatal("filters lost")
	}
	if strings.Contains(response.Body.String(), testPlayerID) {
		t.Fatal("player identity leaked")
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("personal data may be shared cached")
	}
	for _, query := range []string{"minGames=0", "minAverageMs=no", "from=yesterday"} {
		if _, err := parseStatisticsOptions(httptest.NewRequest("GET", "/?"+query, nil)); err == nil {
			t.Fatal(query)
		}
	}
}

func TestStatisticsRepositoryUsesBoundArgumentsAndDecodesSummary(t *testing.T) {
	db := &fakePostgresQueryRower{row: &fakePostgresJSONRow{payload: []byte(`{"entries":[{"scoreId":42,"averageMs":250,"bestMs":200,"missclicks":1.5,"games":2,"totalRounds":10,"createdAt":"2026-09-09T00:00:00Z"}],"summary":{"games":2,"players":1,"averageMs":250,"bestAverageMs":200}}`)}}
	repo := NewPostgresRepository(db)
	got, err := repo.ReadStatistics(context.Background(), StatisticsParams{
		LeaderboardParams: LeaderboardParams{Limit: 5, PrimarySort: LeaderboardSort{Field: "games", Direction: "worst"}, SecondarySort: LeaderboardSort{Field: "averageMs", Direction: "best"}},
		Group:             "players", Player: "';DROP TABLE scores;--", MinGames: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 1 || got.Entries[0].Rank != 1 || got.Entries[0].Missclicks != 1.5 || got.Summary.Games != 2 {
		t.Fatalf("%#v", got)
	}
	if strings.Contains(db.gotSQL, "DROP TABLE") || strings.Contains(db.gotSQL, "/*ORDER*/") || strings.Contains(db.gotSQL, "/*GROUP*/") {
		t.Fatal("unsafe or incomplete SQL")
	}
	if db.gotArgs[0].(pgx.NamedArgs)["player"] != "';DROP TABLE scores;--" {
		t.Fatal("name was not parameterized")
	}
	for _, fault := range []*fakePostgresJSONRow{{err: errors.New("offline")}, {payload: []byte("{")}} {
		db.row = fault
		if _, err := repo.ReadStatistics(t.Context(), StatisticsParams{LeaderboardParams: LeaderboardParams{PrimarySort: LeaderboardSort{Field: "averageMs", Direction: "best"}, SecondarySort: LeaderboardSort{Field: "missclicks", Direction: "best"}}}); err == nil {
			t.Fatal("storage error lost")
		}
	}
}
