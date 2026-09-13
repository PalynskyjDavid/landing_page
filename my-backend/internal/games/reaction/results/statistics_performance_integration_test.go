//go:build integration

package results

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

type statisticsMeasuredDB struct {
	conn *pgx.Conn
	sql  string
	args []any
}

func (db *statisticsMeasuredDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	db.sql, db.args = sql, args
	return db.conn.QueryRow(ctx, sql, args...)
}

func TestPostgresStatisticsWithLargeDataset(t *testing.T) {
	conn, _ := newNameTestDatabase(t)
	applyNameTestMigration(t, conn, 6, false)
	applyNameTestMigration(t, conn, 7, false)
	// This connection's search_path contains only its disposable test schema.
	// Bypass name triggers ONLY while generating consistent synthetic fixture data.
	_, err := conn.Exec(t.Context(), `
        ALTER TABLE scores DISABLE TRIGGER USER;
        INSERT INTO scores (submission_id,player_id,display_name,submitted_display_name,total_rounds,times,average_ms,missclicks,created_at,device_type)
        SELECT md5('game:'||i)::uuid, md5('player:'||(i%1000))::uuid,
               'Player '||(i%1000), 'Player '||(i%1000), 5,
               jsonb_build_array(100+i%900,100+i%900,100+i%900,100+i%900,100+i%900),
               100+i%900,i%7,now()-(i%365)*interval '1 day', CASE WHEN i%4=0 THEN 'mobile' ELSE 'computer' END
        FROM generate_series(1,100000) AS i;
        ALTER TABLE scores ENABLE TRIGGER USER;
        ANALYZE scores;
    `)
	if err != nil {
		t.Fatal(err)
	}
	measured := &statisticsMeasuredDB{conn: conn}
	service := NewService(NewPostgresRepository(measured))
	for _, tc := range []struct {
		name    string
		options StatisticsOptions
	}{
		{"all games", StatisticsOptions{}},
		{"mobile recent players", StatisticsOptions{DeviceType: deviceMobile, Group: "players", Period: "7d"}},
		{"all players", StatisticsOptions{Group: "players"}},
		{"recent players", StatisticsOptions{Group: "players", Period: "7d"}},
		{"combined filters", StatisticsOptions{Period: "30d", Player: "Player 1", MinAverageMs: statisticsInt(200), MaxBestMs: statisticsInt(800), MaxMissclicks: statisticsInt(2)}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			started := time.Now()
			result, err := service.Statistics(t.Context(), tc.options)
			if err != nil {
				t.Fatal(err)
			}
			if len(result.Entries) > 10 {
				t.Fatal("result limit lost")
			}
			t.Logf("100000 games: %s end-to-end repository read, %d matches", time.Since(started), result.Summary.Games)
			var plan []byte
			if err := conn.QueryRow(t.Context(), "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+measured.sql, measured.args...).Scan(&plan); err != nil {
				t.Fatal(err)
			}
			var decoded []map[string]any
			if err := json.Unmarshal(plan, &decoded); err != nil {
				t.Fatal(err)
			}
			t.Logf("EXPLAIN execution time: %v ms", decoded[0]["Execution Time"])
		})
	}
}
