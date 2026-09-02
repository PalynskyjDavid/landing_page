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
	input := validCreateInput()
	input.SessionID = &sessionID

	// Act
	result, err := repository.Create(
		context.Background(),
		input,
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
		TotalRounds: input.TotalRounds,
		Times:       input.Times,
		Missclicks:  input.Missclicks,
		AverageMs:   input.AverageMs,
		SessionID:   input.SessionID,
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
		"total_rounds": input.TotalRounds,
		"times":        `[220,210,230]`,
		"missclicks":   input.Missclicks,
		"average_ms":   input.AverageMs,
		"session_id":   input.SessionID,
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

	result, err := repository.Create(context.Background(), validCreateInput())

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
