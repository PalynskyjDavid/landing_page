package results

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/palyndav/my-backend/internal/apperror"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

func (r *PostgresRepository) Create(ctx context.Context, params CreateParams) (*Result, bool, error) {
	params.DeviceType = defaultDeviceType(params.DeviceType)
	timesJSON, err := json.Marshal(params.Times)
	if err != nil {
		return nil, false, apperror.Internal("score_times_encode_failed", "Failed to save score.", fmt.Errorf("marshal times: %w", err))
	}

	result := &Result{
		SubmissionID: params.SubmissionID,
		PlayerID:     params.PlayerID,
		TotalRounds:  params.TotalRounds,
		Times:        append([]int(nil), params.Times...),
		Missclicks:   params.Missclicks,
		AverageMs:    params.AverageMs,
		DisplayName:  params.DisplayName,
		DeviceType:   params.DeviceType,
	}

	err = r.db.QueryRow(ctx, postgresInsertResultSQL, pgx.NamedArgs{
		"submission_id": params.SubmissionID,
		"player_id":     params.PlayerID,
		"total_rounds":  params.TotalRounds,
		"times":         string(timesJSON),
		"missclicks":    params.Missclicks,
		"average_ms":    params.AverageMs,
		"display_name":  params.DisplayName,
		"device_type":   params.DeviceType,
	}).Scan(&result.ID, &result.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, lookupErr := r.findBySubmissionID(ctx, params.SubmissionID)
		if lookupErr != nil {
			return nil, false, lookupErr
		}
		return existing, false, nil
	}
	if err != nil {
		return nil, false, apperror.Internal("result_insert_failed", "Failed to save score.", err)
	}

	return result, true, nil
}

func (r *PostgresRepository) findBySubmissionID(ctx context.Context, submissionID string) (*Result, error) {
	result := &Result{}
	var timesJSON []byte
	var displayName pgtype.Text

	err := r.db.QueryRow(ctx, postgresSelectResultBySubmissionSQL, pgx.NamedArgs{
		"submission_id": submissionID,
	}).Scan(
		&result.ID,
		&result.TotalRounds,
		&timesJSON,
		&result.Missclicks,
		&result.AverageMs,
		&result.SubmissionID,
		&result.PlayerID,
		&displayName,
		&result.CreatedAt,
		&result.DeviceType,
	)
	if err != nil {
		return nil, apperror.Internal("result_idempotency_lookup_failed", "Failed to save score.", err)
	}

	if err := json.Unmarshal(timesJSON, &result.Times); err != nil {
		return nil, apperror.Internal("score_times_decode_failed", "Failed to save score.", fmt.Errorf("unmarshal times: %w", err))
	}
	if displayName.Valid {
		result.DisplayName = &displayName.String
	}

	return result, nil
}

func (r *PostgresRepository) ListLeaderboard(ctx context.Context, params LeaderboardParams) ([]LeaderboardEntry, error) {
	var encodedEntries []byte
	if err := r.db.QueryRow(ctx, postgresListLeaderboardSQL, pgx.NamedArgs{
		"limit":               params.Limit,
		"primary_sort":        params.PrimarySort.Field,
		"primary_direction":   params.PrimarySort.Direction,
		"secondary_sort":      params.SecondarySort.Field,
		"secondary_direction": params.SecondarySort.Direction,
	}).Scan(&encodedEntries); err != nil {
		return nil, apperror.Internal("leaderboard_query_failed", "Failed to load leaderboard.", err)
	}

	entries := make([]LeaderboardEntry, 0)
	if err := json.Unmarshal(encodedEntries, &entries); err != nil {
		return nil, apperror.Internal("leaderboard_decode_failed", "Failed to load leaderboard.", fmt.Errorf("decode leaderboard: %w", err))
	}

	for index := range entries {
		entries[index].Rank = index + 1
	}

	return entries, nil
}
