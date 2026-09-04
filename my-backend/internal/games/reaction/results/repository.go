package results

import "context"

// Repository is the persistence capability required by Service.
// Database-specific adapters satisfy this interface implicitly.
type Repository interface {
	Create(ctx context.Context, params CreateParams) (*Result, bool, error)
	ListLeaderboard(ctx context.Context, params LeaderboardParams) ([]LeaderboardEntry, error)
}
