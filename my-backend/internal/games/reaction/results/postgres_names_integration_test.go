//go:build integration

package results

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Opt-in tests use real PostgreSQL, but never the application's public tables.
// Each test owns one unique schema and removes only that schema on completion.
func newNameTestDatabase(t *testing.T) (*pgx.Conn, *pgx.ConnConfig) {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("DATABASE_URL is required; run task backend:test:integration")
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal("invalid integration-test DATABASE_URL")
	}
	schema := pgx.Identifier{"score_names_test_" + strings.ToLower(rand.Text())}.Sanitize()
	// No public fallback: a missing test table must fail, not hit real scores.
	config.RuntimeParams["search_path"] = schema + ", pg_catalog"
	config.RuntimeParams["statement_timeout"] = "10000"
	conn, err := pgx.ConnectConfig(t.Context(), config)
	if err != nil {
		t.Fatalf("connect to integration-test PostgreSQL: %v", err)
	}
	created := false
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if created {
			if _, err := conn.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
				t.Errorf("remove owned test schema %s: %v", schema, err)
			}
		}
		if err := conn.Close(ctx); err != nil {
			t.Errorf("close test connection: %v", err)
		}
	})
	if _, err := conn.Exec(t.Context(), "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("create isolated test schema: %v", err)
	}
	created = true
	for version := 1; version <= 5; version++ {
		applyNameTestMigration(t, conn, version, false)
	}
	// These tests deliberately exercise migrations 006/007 separately. The
	// current repository also needs the independent device column from 009.
	applyNameTestMigration(t, conn, 9, false)
	return conn, config
}

func applyNameTestMigration(t *testing.T, conn *pgx.Conn, version int, down bool) {
	t.Helper()
	files, err := filepath.Glob(filepath.Join("..", "..", "..", "..", "migrations", fmt.Sprintf("%03d_*.sql", version)))
	if err != nil || len(files) != 1 {
		t.Fatalf("find migration %d: files=%v, error=%v", version, files, err)
	}
	source, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatal(err)
	}
	upSQL, downSQL, ok := strings.Cut(string(source), "---- create above / drop below ----")
	if !ok {
		t.Fatalf("migration %d has no down section", version)
	}
	sql := upSQL
	if down {
		sql = downSQL
	}
	if _, err := conn.Exec(t.Context(), sql); err != nil {
		t.Fatalf("migration %d (down=%t): %v", version, down, err)
	}
}

func namedTestInput(number int, playerID string, name *string) CreateInput {
	input := validCreateInput()
	input.SubmissionID = fmt.Sprintf("00000000-0000-4000-8000-%012d", number)
	input.PlayerID = playerID
	input.DisplayName = name
	return input
}

func saveNamedTestScore(t *testing.T, service *Service, input CreateInput) *Result {
	t.Helper()
	result, created, err := service.Create(t.Context(), input)
	if err != nil || !created {
		t.Fatalf("save new score: created=%t, error=%v", created, err)
	}
	return result
}

func requirePlayerName(t *testing.T, conn *pgx.Conn, playerID string, name *string, count int) {
	t.Helper()
	var total, matching int
	err := conn.QueryRow(t.Context(), `
		SELECT count(*), count(*) FILTER (WHERE display_name IS NOT DISTINCT FROM $2::text)
		FROM scores WHERE player_id = $1::uuid`, playerID, name).Scan(&total, &matching)
	if err != nil || total != count || matching != count {
		t.Fatalf("player name mismatch: total=%d, matching=%d, want=%d, error=%v", total, matching, count, err)
	}
}

func TestPostgresPlayerNameMigrationAndReplay(t *testing.T) {
	conn, _ := newNameTestDatabase(t)
	service := NewService(NewPostgresRepository(conn))
	oldName, name, renamed := "Old name", "David", "New name"
	otherPlayer := "00000000-0000-4000-8000-000000000002"
	sameNamePlayer := "00000000-0000-4000-8000-000000000003"
	blankInput := namedTestInput(1, testPlayerID, nil)
	namedInput := namedTestInput(3, testPlayerID, &name)
	blankResult := saveNamedTestScore(t, service, blankInput)
	saveNamedTestScore(t, service, namedTestInput(2, testPlayerID, &oldName))
	saveNamedTestScore(t, service, namedInput)
	saveNamedTestScore(t, service, namedTestInput(4, testPlayerID, nil))
	saveNamedTestScore(t, service, namedTestInput(5, otherPlayer, nil))
	saveNamedTestScore(t, service, namedTestInput(6, sameNamePlayer, &name))
	// Tied timestamps exercise the deterministic ID tie-breaker in the backfill.
	if _, err := conn.Exec(t.Context(), "UPDATE scores SET created_at = '2026-01-01T00:00:00Z'"); err != nil {
		t.Fatal(err)
	}
	applyNameTestMigration(t, conn, 6, false)
	requirePlayerName(t, conn, testPlayerID, &name, 4)
	requirePlayerName(t, conn, otherPlayer, nil, 1)
	requirePlayerName(t, conn, sameNamePlayer, &name, 1)
	var original pgtype.Text
	if err := conn.QueryRow(t.Context(), "SELECT submitted_display_name FROM scores WHERE id = $1", blankResult.ID).Scan(&original); err != nil || original.Valid {
		t.Fatalf("original blank name was not preserved: %#v, error=%v", original, err)
	}

	// The displayed name changed, but replaying the original anonymous request
	// still succeeds and returns the original submission response.
	result, created, err := service.Create(t.Context(), blankInput)
	if err != nil || created || result.ID != blankResult.ID || result.DisplayName != nil {
		t.Fatalf("anonymous replay after backfill: result=%#v, created=%t, error=%v", result, created, err)
	}
	saveNamedTestScore(t, service, namedTestInput(7, testPlayerID, &renamed))
	requirePlayerName(t, conn, testPlayerID, &renamed, 5)
	spaces := "   "
	blankNew := saveNamedTestScore(t, service, namedTestInput(8, testPlayerID, &spaces))
	if blankNew.DisplayName != nil {
		t.Fatal("POST response should preserve the normalized submitted name")
	}
	requirePlayerName(t, conn, testPlayerID, &renamed, 6)
	requirePlayerName(t, conn, sameNamePlayer, &name, 1)

	result, created, err = service.Create(t.Context(), namedInput)
	if err != nil || created || result.DisplayName == nil || *result.DisplayName != name {
		t.Fatalf("named replay after rename: result=%#v, created=%t, error=%v", result, created, err)
	}
	requirePlayerName(t, conn, testPlayerID, &renamed, 6)
	conflicting := namedInput
	conflicting.DisplayName = &oldName
	_, _, err = service.Create(t.Context(), conflicting)
	requireErrorCode(t, err, "score_submission_conflict")
	conflicting = namedInput
	conflicting.PlayerID = otherPlayer
	_, _, err = service.Create(t.Context(), conflicting)
	requireErrorCode(t, err, "score_submission_conflict")
	requirePlayerName(t, conn, testPlayerID, &renamed, 6)
	requirePlayerName(t, conn, otherPlayer, nil, 1)

	entries, err := service.Leaderboard(t.Context(), LeaderboardOptions{Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, entry := range entries {
		if entry.ScoreID == blankResult.ID {
			found = entry.DisplayName != nil && *entry.DisplayName == renamed
		}
	}
	if !found {
		t.Fatal("leaderboard did not return the synchronized name for the old anonymous score")
	}

	// Trigger updates roll back together with their score insert.
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	cleanupNameTestTransaction(t, tx)
	saveNamedTestScore(t, NewService(NewPostgresRepository(tx)), namedTestInput(9, testPlayerID, &oldName))
	if err := tx.Rollback(t.Context()); err != nil {
		t.Fatal(err)
	}
	requirePlayerName(t, conn, testPlayerID, &renamed, 6)

	var originalNames, restoredNames string
	if err := conn.QueryRow(t.Context(), "SELECT jsonb_object_agg(id, submitted_display_name)::text FROM scores").Scan(&originalNames); err != nil {
		t.Fatal(err)
	}
	applyNameTestMigration(t, conn, 6, true)
	if err := conn.QueryRow(t.Context(), "SELECT jsonb_object_agg(id, display_name)::text FROM scores").Scan(&restoredNames); err != nil {
		t.Fatal(err)
	}
	if restoredNames != originalNames {
		t.Fatal("down migration did not restore the original per-submission names")
	}
	applyNameTestMigration(t, conn, 6, false)
	requirePlayerName(t, conn, testPlayerID, &renamed, 6)
}

func cleanupNameTestTransaction(t *testing.T, tx pgx.Tx) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			t.Errorf("rollback test transaction: %v", err)
		}
	})
}

func TestPostgresPlayerNamesSerializeConcurrentInserts(t *testing.T) {
	firstName, secondName := "First name", "Second name"
	for _, tc := range []struct {
		name   string
		second *string
		want   *string
	}{
		{name: "new name wins", second: &secondName, want: &secondName},
		{name: "blank inherits committed name", second: nil, want: &firstName},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn, config := newNameTestDatabase(t)
			applyNameTestMigration(t, conn, 6, false)
			second, err := pgx.ConnectConfig(t.Context(), config)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if err := second.Close(ctx); err != nil {
					t.Errorf("close second connection: %v", err)
				}
			})
			tx, err := conn.Begin(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			cleanupNameTestTransaction(t, tx)
			saveNamedTestScore(t, NewService(NewPostgresRepository(tx)), namedTestInput(1, testPlayerID, &firstName))
			done := make(chan error, 1)
			go func() {
				_, created, err := NewService(NewPostgresRepository(second)).Create(t.Context(), namedTestInput(2, testPlayerID, tc.second))
				if err == nil && !created {
					err = errors.New("concurrent score was not created")
				}
				done <- err
			}()
			// Wait for the actual advisory-lock wait, not an arbitrary sleep.
			waitCtx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			ticker := time.NewTicker(10 * time.Millisecond)
			defer ticker.Stop()
			for {
				var waiting bool
				err := tx.QueryRow(waitCtx, `SELECT EXISTS (
					SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory' AND NOT granted
				)`, second.PgConn().PID()).Scan(&waiting)
				if err != nil {
					t.Fatalf("observe concurrent insert waiting: %v", err)
				}
				if waiting {
					break
				}
				select {
				case err := <-done:
					t.Fatalf("second insert did not wait for the first: %v", err)
				case <-waitCtx.Done():
					t.Fatal("timed out waiting for per-player lock")
				case <-ticker.C:
				}
			}
			if err := tx.Commit(t.Context()); err != nil {
				t.Fatal(err)
			}
			select {
			case err := <-done:
				if err != nil {
					t.Fatalf("concurrent insert: %v", err)
				}
			case <-waitCtx.Done():
				t.Fatal("concurrent insert did not finish after the first committed")
			}
			requirePlayerName(t, conn, testPlayerID, tc.want, 2)
		})
	}
}
