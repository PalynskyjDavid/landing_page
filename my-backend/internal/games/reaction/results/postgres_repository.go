package results

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/palyndav/my-backend/internal/apperror"

	"github.com/jackc/pgx/v5"
)

// postgresQueryRower is the PostgreSQL execution capability this adapter needs.
// A pgx pool, connection, transaction, or test fake can provide it.
type postgresQueryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type PostgresRepository struct {
	db postgresQueryRower
}

// Compile-time proof that PostgresRepository satisfies the service's port.
var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(db postgresQueryRower) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, input CreateInput) (*Result, error) {
	timesJSON, err := json.Marshal(input.Times)
	if err != nil {
		return nil, apperror.Internal("score_times_encode_failed", "Failed to save score.", fmt.Errorf("marshal times: %w", err))
	}

	result := &Result{
		TotalRounds: input.TotalRounds,
		Times:       append([]int(nil), input.Times...),
		Missclicks:  input.Missclicks,
		AverageMs:   input.AverageMs,
		SessionID:   input.SessionID,
	}

	err = r.db.QueryRow(ctx, postgresInsertResultSQL, pgx.NamedArgs{
		"total_rounds": input.TotalRounds,
		"times":        string(timesJSON),
		"missclicks":   input.Missclicks,
		"average_ms":   input.AverageMs,
		"session_id":   input.SessionID,
	}).Scan(&result.ID, &result.CreatedAt)
	if err != nil {
		return nil, apperror.Internal("result_insert_failed", "Failed to save score.", err)
	}

	return result, nil
}
