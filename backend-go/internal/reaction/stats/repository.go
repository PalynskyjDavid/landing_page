package stats

import (
	"context"
	"errors"
	"fmt"
	"time"

	"backend-go/internal/apperror"

	"github.com/jackc/pgx/v5"
)

type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Repository interface {
	GetSummary(ctx context.Context) (*Summary, error)
	RefreshSummary(ctx context.Context) (bool, *Summary, error)
}

type PostgresRepository struct {
	db queryRower
}

func NewRepository(db queryRower) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetSummary(ctx context.Context) (*Summary, error) {
	summary, err := scanSummaryRow(r.db.QueryRow(ctx, getSummarySQL))
	if err == nil {
		return summary, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return &Summary{
			ID:        1,
			UpdatedAt: time.Now().UTC(),
		}, nil
	}

	return nil, apperror.Internal("stats_summary_load_failed", "Failed to load stats summary.", err)
}

func (r *PostgresRepository) RefreshSummary(ctx context.Context) (bool, *Summary, error) {
	summary, err := scanSummaryRow(r.db.QueryRow(ctx, rebuildSummarySQL))
	if err == nil {
		return true, summary, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		current, loadErr := r.GetSummary(ctx)
		if loadErr != nil {
			return false, nil, loadErr
		}

		return false, current, nil
	}

	return false, nil, apperror.Internal("stats_summary_refresh_failed", "Failed to refresh stats summary.", err)
}

func scanSummaryRow(row pgx.Row) (*Summary, error) {
	summary := &Summary{}
	err := row.Scan(
		&summary.ID,
		&summary.TotalGames,
		&summary.AverageReactionMs,
		&summary.BestAverageMs,
		&summary.WorstAverageMs,
		&summary.AverageMissclicks,
		&summary.SourceUpdatedAt,
		&summary.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan stats summary: %w", err)
	}

	return summary, nil
}
