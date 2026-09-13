//go:build integration

package results

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestPostgresDeviceBackfillFilteringReplayAndRollback(t *testing.T) {
	conn, _ := newNameTestDatabase(t)
	// Start at the old production schema, before any device column existed.
	applyNameTestMigration(t, conn, 9, true)
	for version := 6; version <= 8; version++ {
		applyNameTestMigration(t, conn, version, false)
	}
	for number, average := range []int{200, 300} {
		input := namedTestInput(number+1, testPlayerID, nil)
		_, err := conn.Exec(t.Context(), "INSERT INTO scores (submission_id, player_id, total_rounds, times, average_ms, missclicks) VALUES ($1, $2, 5, jsonb_build_array($3::integer,$3::integer,$3::integer,$3::integer,$3::integer), $3, 0)", input.SubmissionID, input.PlayerID, average)
		if err != nil {
			t.Fatal(err)
		}
	}
	applyNameTestMigration(t, conn, 9, false)
	var count int
	if err := conn.QueryRow(t.Context(), "SELECT count(*) FROM scores WHERE device_type='computer'").Scan(&count); err != nil || count != 2 {
		t.Fatalf("historical scores were not backfilled: %d, %v", count, err)
	}
	for _, bad := range []struct{ sql, code string }{
		{"UPDATE scores SET device_type='tablet'", "23514"},
		{"UPDATE scores SET device_type=NULL", "23502"},
	} {
		_, err := conn.Exec(t.Context(), bad.sql)
		var postgresError *pgconn.PgError
		if !errors.As(err, &postgresError) || postgresError.Code != bad.code {
			t.Fatalf("constraint not enforced: %v", err)
		}
	}
	service := NewService(NewPostgresRepository(conn))
	old := namedTestInput(1, testPlayerID, nil)
	old.Times = []int{200, 200, 200, 200, 200}
	existing, created, err := service.Create(t.Context(), old)
	if err != nil || created || existing.DeviceType != deviceComputer {
		t.Fatalf("old-client replay failed: %v", err)
	}
	mobile := namedTestInput(3, testPlayerID, nil)
	mobile.DeviceType = deviceMobile
	mobile.Times = []int{100, 100, 100, 100, 100}
	saved := saveNamedTestScore(t, service, mobile)
	replay, created, err := service.Create(t.Context(), mobile)
	if err != nil || created || replay.ID != saved.ID || replay.DeviceType != deviceMobile {
		t.Fatalf("mobile replay failed: %v", err)
	}
	mobile.DeviceType = deviceComputer
	_, _, err = service.Create(t.Context(), mobile)
	requireErrorCode(t, err, "score_submission_conflict")
	for _, tc := range []struct {
		device  string
		games   int64
		average int
		label   string
	}{
		{"", 3, 200, "mixed"}, {"computer", 2, 250, "computer"}, {"mobile", 1, 100, "mobile"},
	} {
		for _, group := range []string{"games", "players"} {
			report, err := service.Statistics(t.Context(), StatisticsOptions{DeviceType: tc.device, Group: group, LeaderboardOptions: LeaderboardOptions{Limit: 1}})
			if err != nil {
				t.Fatal(err)
			}
			if report.Summary.Games != tc.games || *report.Summary.AverageMs != tc.average || len(report.Entries) != 1 {
				t.Fatalf("wrong device summary: %#v", report)
			}
			if group == "players" && (report.Entries[0].DeviceType != tc.label || report.Entries[0].AverageMs != tc.average) {
				t.Fatalf("wrong player aggregate: %#v", report.Entries)
			}
			if tc.device != "" && report.Entries[0].DeviceType != tc.device {
				t.Fatal("device filter did not constrain rows")
			}
		}
	}
	report, err := service.Statistics(t.Context(), StatisticsOptions{DeviceType: deviceMobile, Group: "players", MinGames: 2})
	if err != nil || report.Summary.Games != 0 || len(report.Entries) != 0 {
		t.Fatalf("device filter must precede minGames: %v", err)
	}
	var indexExists bool
	if err := conn.QueryRow(t.Context(), "SELECT to_regclass('scores_device_created_at_idx') IS NOT NULL").Scan(&indexExists); err != nil || !indexExists {
		t.Fatal("device/time index missing")
	}
	applyNameTestMigration(t, conn, 9, true)
	var total int
	if err := conn.QueryRow(t.Context(), "SELECT count(*), sum(average_ms) FROM scores").Scan(&count, &total); err != nil || count != 3 || total != 600 {
		t.Fatalf("rollback changed score data: %d, %d, %v", count, total, err)
	}
	applyNameTestMigration(t, conn, 9, false)
	if err := conn.QueryRow(t.Context(), "SELECT count(*) FROM scores WHERE device_type='computer'").Scan(&count); err != nil || count != 3 {
		t.Fatalf("reapply must default existing rows to computer: %v", err)
	}
}
