package results

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/palyndav/my-backend/internal/apperror"

	"github.com/jackc/pgx/v5"
)

// fakePostgresRow simulates the row returned by pgx.QueryRow.
type fakePostgresRow struct {
	id        int64
	createdAt time.Time
	err       error
}

type fakePostgresJSONRow struct {
	payload []byte
	err     error
}

func (r *fakePostgresJSONRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != 1 {
		return fmt.Errorf("expected 1 scan destination, got %d", len(dest))
	}

	payloadDestination, ok := dest[0].(*[]byte)
	if !ok {
		return fmt.Errorf("expected destination to be *[]byte, got %T", dest[0])
	}
	*payloadDestination = append([]byte(nil), r.payload...)

	return nil
}

func (r *fakePostgresRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}

	if len(dest) != 2 {
		return fmt.Errorf(
			"expected 2 scan destinations, got %d",
			len(dest),
		)
	}

	idDestination, ok := dest[0].(*int64)
	if !ok {
		return fmt.Errorf(
			"expected first destination to be *int64, got %T",
			dest[0],
		)
	}

	createdAtDestination, ok := dest[1].(*time.Time)
	if !ok {
		return fmt.Errorf(
			"expected second destination to be *time.Time, got %T",
			dest[1],
		)
	}

	*idDestination = r.id
	*createdAtDestination = r.createdAt

	return nil
}

type fakePostgresQueryRower struct {
	gotSQL  string
	gotArgs []any
	row     pgx.Row
}

func (f *fakePostgresQueryRower) QueryRow(
	_ context.Context,
	sql string,
	args ...any,
) pgx.Row {
	f.gotSQL = sql
	f.gotArgs = append([]any(nil), args...)

	return f.row
}

func TestPostgresRepositoryCreateMapsQueryAndReturnsStoredResult(t *testing.T) {
	// Arrange
	createdAt := time.Date(
		2026,
		time.September,
		1,
		12,
		0,
		0,
		0,
		time.UTC,
	)

	fakeDB := &fakePostgresQueryRower{
		row: &fakePostgresRow{
			id:        42,
			createdAt: createdAt,
		},
	}

	repository := NewPostgresRepository(fakeDB)
	sessionID := "session-123"
	displayName := "David"
	params := CreateParams{
		TotalRounds: requiredRoundCount,
		Times:       []int{241, 228, 255, 249, 235},
		Missclicks:  1,
		AverageMs:   241,
		SessionID:   &sessionID,
		DisplayName: &displayName,
	}

	// Act
	result, err := repository.Create(
		context.Background(),
		params,
	)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result == nil {
		t.Fatal("expected result, got nil")
	}

	wantResult := &Result{
		ID:          42,
		TotalRounds: params.TotalRounds,
		Times:       params.Times,
		Missclicks:  params.Missclicks,
		AverageMs:   params.AverageMs,
		SessionID:   params.SessionID,
		DisplayName: params.DisplayName,
		CreatedAt:   createdAt,
	}
	if !reflect.DeepEqual(result, wantResult) {
		t.Fatalf("unexpected result:\nwant: %#v\ngot:  %#v", wantResult, result)
	}

	if fakeDB.gotSQL != postgresInsertResultSQL {
		t.Fatal("expected PostgreSQL insert query")
	}
	if len(fakeDB.gotArgs) != 1 {
		t.Fatalf("expected one QueryRow argument, got %d", len(fakeDB.gotArgs))
	}

	namedArgs, ok := fakeDB.gotArgs[0].(pgx.NamedArgs)
	if !ok {
		t.Fatalf("expected pgx.NamedArgs, got %T", fakeDB.gotArgs[0])
	}

	wantArgs := pgx.NamedArgs{
		"total_rounds": params.TotalRounds,
		"times":        `[241,228,255,249,235]`,
		"missclicks":   params.Missclicks,
		"average_ms":   params.AverageMs,
		"session_id":   params.SessionID,
		"display_name": params.DisplayName,
	}
	if !reflect.DeepEqual(namedArgs, wantArgs) {
		t.Fatalf("unexpected query arguments:\nwant: %#v\ngot:  %#v", wantArgs, namedArgs)
	}
}

func TestPostgresRepositoryCreateWrapsDatabaseError(t *testing.T) {
	databaseError := errors.New("database unavailable")
	fakeDB := &fakePostgresQueryRower{
		row: &fakePostgresRow{err: databaseError},
	}
	repository := NewPostgresRepository(fakeDB)

	result, err := repository.Create(context.Background(), CreateParams{
		TotalRounds: requiredRoundCount,
		Times:       []int{241, 228, 255, 249, 235},
		AverageMs:   241,
	})

	if result != nil {
		t.Fatalf("expected nil result, got %#v", result)
	}
	if err == nil {
		t.Fatal("expected repository error, got nil")
	}
	if !errors.Is(err, databaseError) {
		t.Fatalf("expected wrapped database error %v, got %v", databaseError, err)
	}

	appErr := apperror.From(err)
	if appErr.Code != "result_insert_failed" {
		t.Fatalf("expected error code result_insert_failed, got %q", appErr.Code)
	}
}

func TestPostgresRepositoryListLeaderboardMapsQueryAndRanksEntries(t *testing.T) {
	fakeDB := &fakePostgresQueryRower{row: &fakePostgresJSONRow{payload: []byte(`[
		{"scoreId":42,"displayName":"David","averageMs":241,"bestMs":228,"totalRounds":5,"missclicks":1,"createdAt":"2026-09-03T12:00:00Z"},
		{"scoreId":43,"displayName":null,"averageMs":250,"bestMs":240,"totalRounds":5,"missclicks":0,"createdAt":"2026-09-03T12:05:00Z"}
	]`)}}
	repository := NewPostgresRepository(fakeDB)

	params := LeaderboardParams{
		Limit:         10,
		PrimarySort:   LeaderboardSort{Field: leaderboardSortBestMs, Direction: leaderboardSortWorst},
		SecondarySort: LeaderboardSort{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
	}
	entries, err := repository.ListLeaderboard(context.Background(), params)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected two entries, got %d", len(entries))
	}
	if entries[0].Rank != 1 || entries[0].ScoreID != 42 {
		t.Fatalf("unexpected first entry: %#v", entries[0])
	}
	if entries[1].Rank != 2 || entries[1].DisplayName != nil {
		t.Fatalf("unexpected second entry: %#v", entries[1])
	}
	if fakeDB.gotSQL != postgresListLeaderboardSQL {
		t.Fatal("expected PostgreSQL leaderboard query")
	}

	namedArgs, ok := fakeDB.gotArgs[0].(pgx.NamedArgs)
	if !ok {
		t.Fatalf("expected pgx.NamedArgs, got %T", fakeDB.gotArgs[0])
	}
	if namedArgs["limit"] != 10 {
		t.Fatalf("expected query limit 10, got %#v", namedArgs["limit"])
	}
	if namedArgs["primary_sort"] != leaderboardSortBestMs {
		t.Fatalf("expected primary sort bestMs, got %#v", namedArgs["primary_sort"])
	}
	if namedArgs["primary_direction"] != leaderboardSortWorst {
		t.Fatalf("expected primary direction worst, got %#v", namedArgs["primary_direction"])
	}
	if namedArgs["secondary_sort"] != leaderboardSortMissclicks {
		t.Fatalf("expected secondary sort missclicks, got %#v", namedArgs["secondary_sort"])
	}
	if namedArgs["secondary_direction"] != leaderboardSortBest {
		t.Fatalf("expected secondary direction best, got %#v", namedArgs["secondary_direction"])
	}
}
