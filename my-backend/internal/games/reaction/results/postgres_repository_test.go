package results

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/palyndav/my-backend/internal/apperror"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// fakePostgresRow simulates the row returned by pgx.QueryRow.
type fakePostgresRow struct {
	id        int64
	createdAt time.Time
	result    *Result
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

	if len(dest) == 10 {
		return r.scanStoredResult(dest)
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

func (r *fakePostgresRow) scanStoredResult(dest []any) error {
	if r.result == nil {
		return errors.New("stored result is not configured")
	}

	timesJSON, err := json.Marshal(r.result.Times)
	if err != nil {
		return err
	}

	*dest[0].(*int64) = r.result.ID
	*dest[1].(*int) = r.result.TotalRounds
	*dest[2].(*[]byte) = timesJSON
	*dest[3].(*int) = r.result.Missclicks
	*dest[4].(*int) = r.result.AverageMs
	*dest[5].(*string) = r.result.SubmissionID
	*dest[6].(*string) = r.result.PlayerID
	displayName := dest[7].(*pgtype.Text)
	if r.result.DisplayName != nil {
		*displayName = pgtype.Text{String: *r.result.DisplayName, Valid: true}
	}
	*dest[8].(*time.Time) = r.result.CreatedAt
	*dest[9].(*string) = r.result.DeviceType

	return nil
}

type fakePostgresQueryRower struct {
	gotSQL  string
	gotSQLs []string
	gotArgs []any
	row     pgx.Row
	rows    []pgx.Row
}

func (f *fakePostgresQueryRower) QueryRow(
	_ context.Context,
	sql string,
	args ...any,
) pgx.Row {
	f.gotSQL = sql
	f.gotSQLs = append(f.gotSQLs, sql)
	f.gotArgs = append([]any(nil), args...)
	if len(f.rows) > 0 {
		row := f.rows[0]
		f.rows = f.rows[1:]
		return row
	}

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
	displayName := "David"
	params := CreateParams{
		DeviceType:   deviceMobile,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		AverageMs:    241,
		DisplayName:  &displayName,
	}

	// Act
	result, created, err := repository.Create(
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
	if !created {
		t.Fatal("expected result to be newly created")
	}

	wantResult := &Result{
		ID:           42,
		SubmissionID: params.SubmissionID,
		PlayerID:     params.PlayerID,
		TotalRounds:  params.TotalRounds,
		Times:        params.Times,
		Missclicks:   params.Missclicks,
		AverageMs:    params.AverageMs,
		DisplayName:  params.DisplayName,
		DeviceType:   defaultDeviceType(params.DeviceType),
		CreatedAt:    createdAt,
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
		"submission_id": params.SubmissionID,
		"player_id":     params.PlayerID,
		"total_rounds":  params.TotalRounds,
		"times":         `[241,228,255,249,235]`,
		"missclicks":    params.Missclicks,
		"average_ms":    params.AverageMs,
		"display_name":  params.DisplayName,
		"device_type":   defaultDeviceType(params.DeviceType),
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

	result, created, err := repository.Create(context.Background(), CreateParams{
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		AverageMs:    241,
	})

	if result != nil || created {
		t.Fatalf("expected nil result, got %#v, created %t", result, created)
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

func TestPostgresRepositoryCreateReturnsExistingSubmission(t *testing.T) {
	createdAt := time.Date(2026, time.September, 1, 12, 0, 0, 0, time.UTC)
	displayName := "David"
	existing := &Result{
		ID:           42,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		AverageMs:    241,
		DisplayName:  &displayName,
		CreatedAt:    createdAt,
	}
	fakeDB := &fakePostgresQueryRower{rows: []pgx.Row{
		&fakePostgresRow{err: pgx.ErrNoRows},
		&fakePostgresRow{result: existing},
	}}
	repository := NewPostgresRepository(fakeDB)

	result, created, err := repository.Create(context.Background(), CreateParams{
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		AverageMs:    241,
		DisplayName:  &displayName,
	})

	if err != nil {
		t.Fatalf("expected existing submission, got error %v", err)
	}
	if created {
		t.Fatal("expected existing submission not to be newly created")
	}
	if !reflect.DeepEqual(result, existing) {
		t.Fatalf("expected %#v, got %#v", existing, result)
	}
	if !reflect.DeepEqual(fakeDB.gotSQLs, []string{postgresInsertResultSQL, postgresSelectResultBySubmissionSQL}) {
		t.Fatalf("unexpected query sequence: %#v", fakeDB.gotSQLs)
	}

	namedArgs := fakeDB.gotArgs[0].(pgx.NamedArgs)
	if namedArgs["submission_id"] != testSubmissionID {
		t.Fatalf("expected lookup by submission ID, got %#v", namedArgs)
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
