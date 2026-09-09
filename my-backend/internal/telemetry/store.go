package telemetry

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ Pool *pgxpool.Pool }

func (s Store) WriteBatch(ctx context.Context, batch Batch, collector string, started time.Time, dropped int64) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		inserted, err := tx.Exec(ctx, "INSERT INTO telemetry_batches(id) VALUES($1) ON CONFLICT DO NOTHING", batch.ID)
		if err != nil {
			return err
		}
		if inserted.RowsAffected() != 0 {
			for key, value := range batch.Rows {
				_, err = tx.Exec(ctx, `INSERT INTO request_metrics_minute
                (minute,route,method,requests,client_errors,server_errors,not_found,rate_limited,duration_ms)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (minute,route,method) DO UPDATE SET
                requests=request_metrics_minute.requests+EXCLUDED.requests,
                client_errors=request_metrics_minute.client_errors+EXCLUDED.client_errors,
                server_errors=request_metrics_minute.server_errors+EXCLUDED.server_errors,
                not_found=request_metrics_minute.not_found+EXCLUDED.not_found,
                rate_limited=request_metrics_minute.rate_limited+EXCLUDED.rate_limited,
                duration_ms=request_metrics_minute.duration_ms+EXCLUDED.duration_ms`,
					key.Minute, key.Route, key.Method, value.Requests, value.ClientErrors, value.ServerErrors, value.NotFound, value.RateLimited, value.DurationMS)
				if err != nil {
					return err
				}
			}
		}
		_, err = tx.Exec(ctx, `INSERT INTO telemetry_collectors(id,started_at,dropped_events) VALUES($1,$2,$3)
            ON CONFLICT(id) DO UPDATE SET updated_at=now(),dropped_events=GREATEST(telemetry_collectors.dropped_events,EXCLUDED.dropped_events)`, collector, started, dropped)
		return err
	})
}

func (s Store) Prune(ctx context.Context) error {
	// Dedup records outlive both the retained metrics and the ten-minute buffer.
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		for _, query := range []string{
			"DELETE FROM request_metrics_minute WHERE minute < now()-interval '7 days'",
			"DELETE FROM telemetry_batches WHERE received_at < now()-interval '8 days'",
			"DELETE FROM telemetry_collectors WHERE updated_at < now()-interval '8 days'",
		} {
			if _, err := tx.Exec(ctx, query); err != nil {
				return err
			}
		}
		return nil
	})
}
