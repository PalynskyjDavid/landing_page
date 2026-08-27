package stats

import (
	"context"
	"log/slog"
	"time"
)

type Worker struct {
	logger         *slog.Logger
	statsService   *Service
	updateInterval time.Duration
}

func NewWorker(logger *slog.Logger, statsService *Service, updateInterval time.Duration) *Worker {
	return &Worker{
		logger:         logger,
		statsService:   statsService,
		updateInterval: updateInterval,
	}
}

func (w *Worker) Run(ctx context.Context) error {
	w.runOnce(ctx)

	ticker := time.NewTicker(w.updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("worker shutting down")
			return nil
		case <-ticker.C:
			w.runOnce(ctx)
		}
	}
}

func (w *Worker) runOnce(ctx context.Context) {
	changed, summary, err := w.statsService.RefreshSummary(ctx)
	if err != nil {
		w.logger.Error("refresh stats summary", slog.String("error", err.Error()))
		return
	}

	if !changed {
		w.logger.Debug("stats summary unchanged")
		return
	}

	w.logger.Info("stats summary refreshed",
		slog.Int64("total_games", summary.TotalGames),
		slog.Time("updated_at", summary.UpdatedAt),
	)
}
