//go:build integration

package results

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/palyndav/my-backend/internal/telemetry"
)

func TestTelemetryBatchReplayAggregationAndRetention(t *testing.T) {
	conn, cfg := newNameTestDatabase(t)
	for _, version := range []int{6, 7, 8} {
		applyNameTestMigration(t, conn, version, false)
	}
	poolConfig, err := pgxpool.ParseConfig(cfg.ConnString())
	if err != nil {
		t.Fatal(err)
	}
	poolConfig.ConnConfig = cfg.Copy()
	pool, err := pgxpool.NewWithConfig(t.Context(), poolConfig)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store := telemetry.Store{Pool: pool}
	now := time.Now().UTC()
	key := telemetry.Key{Minute: now.Truncate(time.Minute), Route: "/scores", Method: "POST"}
	batch := telemetry.Batch{ID: testSubmissionID, Rows: map[telemetry.Key]telemetry.Counters{key: {Requests: 3, ClientErrors: 1, ServerErrors: 1, RateLimited: 1, DurationMS: 150}}}
	for range 2 {
		if err := store.WriteBatch(t.Context(), batch, testPlayerID, now, 2); err != nil {
			t.Fatal(err)
		}
	}
	reader := telemetry.Reader{DB: conn}
	report, err := reader.Read(t.Context(), telemetry.Options{Period: "1h"})
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.Requests != 3 || report.Summary.DurationMS != 150 || report.DroppedEvents != 2 || len(report.Points) != 61 || report.LastCollectedAt == nil {
		t.Fatalf("wrong report: %+v", report)
	}
	filtered, err := reader.Read(t.Context(), telemetry.Options{Period: "24h", Route: "<unmatched>"})
	if err != nil {
		t.Fatal(err)
	}
	if filtered.Summary.Requests != 0 || len(filtered.Points) != 289 {
		t.Fatal("wrong empty filter/grid")
	}
	if _, err := conn.Exec(t.Context(), `INSERT INTO telemetry_batches VALUES('00000000-0000-4000-8000-000000000099',now()-interval '9 days');
 INSERT INTO request_metrics_minute VALUES(now()-interval '9 days','/scores','GET',1,0,0,0,0,1)`); err != nil {
		t.Fatal(err)
	}
	if err := store.Prune(t.Context()); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := conn.QueryRow(t.Context(), "SELECT count(*) FROM telemetry_batches").Scan(&count); err != nil || count != 1 {
		t.Fatalf("bad retention count=%d err=%v", count, err)
	}
	applyNameTestMigration(t, conn, 8, true)
	applyNameTestMigration(t, conn, 8, false)
	empty, err := reader.Read(t.Context(), telemetry.Options{Period: "7d"})
	if err != nil || empty.Summary.Requests != 0 || len(empty.Points) != 169 {
		t.Fatalf("bad empty report err=%v", err)
	}
}
