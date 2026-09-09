package telemetry

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

type Options struct{ Period, Route string }
type Point struct {
	Counters
	Time time.Time `json:"time"`
}
type Report struct {
	Source             string     `json:"source"`
	GeneratedAt        time.Time  `json:"generatedAt"`
	LastCollectedAt    *time.Time `json:"lastCollectedAt"`
	CollectorStartedAt *time.Time `json:"collectorStartedAt"`
	DroppedEvents      int64      `json:"droppedEvents"`
	Summary            Counters   `json:"summary"`
	Points             []Point    `json:"points"`
}
type Queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Reader struct{ DB Queryer }

func (r Reader) Read(ctx context.Context, options Options) (*Report, error) {
	window, step := time.Hour, time.Minute
	switch options.Period {
	case "24h":
		window, step = 24*time.Hour, 5*time.Minute
	case "7d":
		window, step = 7*24*time.Hour, time.Hour
	}
	// Complete UTC buckets plus the current partial bucket; at most 289 points.
	var payload []byte
	err := r.DB.QueryRow(ctx, reportSQL, int64(window.Seconds()), int64(step.Seconds()), options.Route).Scan(&payload)
	if err != nil {
		return nil, err
	}
	var report Report
	if err = json.Unmarshal(payload, &report); err != nil {
		return nil, err
	}
	return &report, nil
}

const reportSQL = `WITH bounds AS (
    SELECT date_bin(make_interval(secs=>$2),now(),timestamptz '2000-01-01') AS ending
), filtered AS (
    SELECT * FROM request_metrics_minute
    WHERE minute >= (SELECT ending FROM bounds)-make_interval(secs=>$1)
      AND minute < (SELECT ending FROM bounds)+make_interval(secs=>$2)
      AND ($3::text='' OR route=$3)
), grouped AS (
    SELECT date_bin(make_interval(secs=>$2),minute,timestamptz '2000-01-01') AS time,
           sum(requests) AS requests,sum(client_errors) AS client_errors,
           sum(server_errors) AS server_errors,sum(not_found) AS not_found,
           sum(rate_limited) AS rate_limited,sum(duration_ms) AS duration_ms
    FROM filtered GROUP BY 1
), points AS (
    SELECT jsonb_build_object('time',tick,'requests',coalesce(g.requests,0),
      'clientErrors',coalesce(g.client_errors,0),'serverErrors',coalesce(g.server_errors,0),
      'notFound',coalesce(g.not_found,0),'rateLimited',coalesce(g.rate_limited,0),
      'durationMs',coalesce(g.duration_ms,0)) AS value,tick
    FROM bounds,generate_series(ending-make_interval(secs=>$1),ending,make_interval(secs=>$2)) tick
    LEFT JOIN grouped g ON g.time=tick
)
SELECT jsonb_build_object('source','nginx','generatedAt',now(),
 'lastCollectedAt',(SELECT max(updated_at) FROM telemetry_collectors),
 'collectorStartedAt',(SELECT max(started_at) FROM telemetry_collectors),
 'droppedEvents',(SELECT coalesce(sum(dropped_events),0) FROM telemetry_collectors),
 'summary',(SELECT jsonb_build_object('requests',coalesce(sum(requests),0),
    'clientErrors',coalesce(sum(client_errors),0),'serverErrors',coalesce(sum(server_errors),0),
    'notFound',coalesce(sum(not_found),0),'rateLimited',coalesce(sum(rate_limited),0),
    'durationMs',coalesce(sum(duration_ms),0)) FROM filtered),
 'points',(SELECT jsonb_agg(value ORDER BY tick) FROM points))`
