package results

import "github.com/palyndav/my-backend/internal/games/reaction/results/model"

type Result = model.Result

type CreateInput struct {
	TotalRounds int
	Times       []int
	Missclicks  int
	AverageMs   int
	SessionID   *string
}

// Values which are expected to be passed
