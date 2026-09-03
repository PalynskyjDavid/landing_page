package results

import "github.com/palyndav/my-backend/internal/games/reaction/results/model"

type Result = model.Result

// CreateInput contains values supplied by the caller.
type CreateInput struct {
	Times       []int
	Missclicks  int
	SessionID   *string
	DisplayName *string
}

// CreateParams contains validated and derived values ready for persistence.
type CreateParams struct {
	TotalRounds int
	Times       []int
	Missclicks  int
	AverageMs   int
	SessionID   *string
	DisplayName *string
}
