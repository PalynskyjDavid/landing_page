//go:build integration

package results

import (
	"testing"
	"time"
)

func TestPostgresStatisticsFiltersGroupingAndMigration(t *testing.T) {
	conn, _ := newNameTestDatabase(t)
	applyNameTestMigration(t, conn, 6, false)
	applyNameTestMigration(t, conn, 7, false)
	service := NewService(NewPostgresRepository(conn))
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	alice, bob, charlie := "Alice_%'", "Bob", "Charlie"
	players := []string{testPlayerID, "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"}
	games := []struct {
		player, average, missclicks, days int
		name                              *string
	}{
		{0, 100, 1, 40, &alice}, {0, 200, 2, 2, &alice}, {0, 300, 0, 1, &alice},
		{1, 400, 4, 3, &bob}, {1, 500, 2, 0, &bob}, {2, 50, 0, 20, &charlie},
	}
	for index, game := range games {
		input := namedTestInput(index+1, players[game.player], game.name)
		input.Times = []int{game.average, game.average, game.average, game.average, game.average}
		input.Missclicks = game.missclicks
		saved := saveNamedTestScore(t, service, input)
		if _, err := conn.Exec(t.Context(), "UPDATE scores SET created_at=$1 WHERE id=$2", now.Add(-time.Duration(game.days)*24*time.Hour), saved.ID); err != nil {
			t.Fatal(err)
		}
	}
	read := func(options StatisticsOptions) *Statistics {
		t.Helper()
		result, err := service.Statistics(t.Context(), options)
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	all := read(StatisticsOptions{LeaderboardOptions: LeaderboardOptions{Limit: 1}})
	if all.Summary.Games != 6 || all.Summary.Players != 3 || *all.Summary.AverageMs != 258 || *all.Summary.BestAverageMs != 50 || len(all.Entries) != 1 {
		t.Fatalf("summary must ignore top limit: %#v", all)
	}
	grouped := read(StatisticsOptions{Period: "7d", Group: "players"})
	if len(grouped.Entries) != 2 || grouped.Entries[0].AverageMs != 250 || grouped.Entries[0].Games != 2 || grouped.Entries[0].Missclicks != 1 || grouped.Entries[1].AverageMs != 450 || grouped.Summary.Games != 4 || *grouped.Summary.AverageMs != 350 {
		t.Fatalf("wrong grouping: %#v", grouped)
	}
	filtered := read(StatisticsOptions{Group: "players", Period: "7d", MaxAverageMs: statisticsInt(300), MinBestMs: statisticsInt(200), MinMissclicks: statisticsInt(1)})
	if len(filtered.Entries) != 1 || filtered.Entries[0].AverageMs != 200 || filtered.Summary.Games != 1 {
		t.Fatalf("filter must precede aggregation: %#v", filtered)
	}
	mine := read(StatisticsOptions{Scope: "mine", PlayerID: players[0], Player: "_%'"})
	if mine.Summary.Games != 3 || mine.Summary.Players != 1 {
		t.Fatal("literal name filter or cookie scope failed")
	}
	empty := read(StatisticsOptions{Group: "players", Period: "7d", MinGames: 3})
	if len(empty.Entries) != 0 || empty.Summary.Games != 0 || empty.Summary.AverageMs != nil || empty.Summary.BestAverageMs != nil {
		t.Fatalf("wrong empty response: %#v", empty)
	}
	from, to := now.Add(-2*24*time.Hour), now.Add(-24*time.Hour)
	dated := read(StatisticsOptions{From: &from, To: &to})
	if dated.Summary.Games != 1 || dated.Entries[0].AverageMs != 200 {
		t.Fatal("date bounds must be inclusive/exclusive")
	}
	for _, field := range []LeaderboardSortField{"averageMs", "bestMs", "missclicks", "games", "createdAt"} {
		for _, direction := range []LeaderboardSortDirection{"best", "worst"} {
			read(StatisticsOptions{Group: "players", LeaderboardOptions: LeaderboardOptions{Sort: []LeaderboardSort{{Field: field, Direction: direction}}}})
		}
	}
	// Index/derived-column rollback must not delete scores.
	applyNameTestMigration(t, conn, 7, true)
	var count int
	if err := conn.QueryRow(t.Context(), "SELECT count(*) FROM scores").Scan(&count); err != nil || count != 6 {
		t.Fatalf("rollback lost scores: %d, %v", count, err)
	}
	applyNameTestMigration(t, conn, 7, false)
	if read(StatisticsOptions{}).Summary.Games != 6 {
		t.Fatal("migration replay changed scores")
	}
}
