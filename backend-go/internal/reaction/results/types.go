package results

import "backend-go/internal/reaction"

type Result = reaction.Result

type CreateInput struct {
	TotalRounds int
	Times       []int
	Missclicks  int
	AverageMs   int
	SessionID   *string
}
