package results

import "github.com/palyndav/my-backend/internal/games/reaction/results/model"

type Result = model.Result
type LeaderboardEntry = model.LeaderboardEntry

type LeaderboardSortField string
type LeaderboardSortDirection string

const (
	leaderboardSortAverageMs  LeaderboardSortField = "averageMs"
	leaderboardSortBestMs     LeaderboardSortField = "bestMs"
	leaderboardSortMissclicks LeaderboardSortField = "missclicks"

	leaderboardSortBest  LeaderboardSortDirection = "best"
	leaderboardSortWorst LeaderboardSortDirection = "worst"
)

type LeaderboardSort struct {
	Field     LeaderboardSortField
	Direction LeaderboardSortDirection
}

type LeaderboardOptions struct {
	Limit int
	Sort  []LeaderboardSort
}

type LeaderboardParams struct {
	Limit         int
	PrimarySort   LeaderboardSort
	SecondarySort LeaderboardSort
}

// CreateInput contains values supplied by the caller.
type CreateInput struct {
	SubmissionID string
	PlayerID     string
	Times        []int
	Missclicks   int
	DisplayName  *string
	DeviceType   string
}

// CreateParams contains validated and derived values ready for persistence.
type CreateParams struct {
	SubmissionID string
	PlayerID     string
	TotalRounds  int
	Times        []int
	Missclicks   int
	AverageMs    int
	DisplayName  *string
	DeviceType   string
}
