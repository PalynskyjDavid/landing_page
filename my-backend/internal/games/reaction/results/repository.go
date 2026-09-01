package results

import "context"

// Repository is the persistence capability required by Service.
// Database-specific adapters satisfy this interface implicitly.
type Repository interface {
	Create(ctx context.Context, input CreateInput) (*Result, error)
}
