package results

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/palyndav/my-backend/internal/apperror"

	"github.com/jackc/pgx/v5"
)

// Context - lifecycle, cancellation and timeouts of requests.
// ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
// defer cancel()
type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Repository interface {
	Create(ctx context.Context, input CreateInput) (*Result, error)
}

// Wihtout queryRower interface we would have to do
// type PostgresRepository struct {
//	db *pgxpool.Pool }
// or
// { db pgx.Tx } for transactions
// or
// { db pgx.Conn } for single connection.

type PostgresRepository struct {
	db queryRower
}

func NewRepository(db queryRower) *PostgresRepository {
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

	err = r.db.QueryRow(ctx, insertResultSQL, pgx.NamedArgs{
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
