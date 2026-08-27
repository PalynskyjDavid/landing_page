package postgresql

import (
	"context"
	"fmt"

	"github.com/palyndav/my-backend/internal/config"
	
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool for reusable connections
func Open(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DATABASE_URL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	// Modify settings
	// also can do 30 * time.Minute
	poolConfig.MaxConnLifetime = cfg.MAX_CONN_LIFETIME
	poolConfig.MaxConnIdleTime = cfg.MAX_CONN_IDLE_TIME
	poolConfig.MinConns = cfg.MIN_CONNS
	poolConfig.MaxConns = cfg.MAX_CONNS

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("open postgres pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return pool, nil
}
