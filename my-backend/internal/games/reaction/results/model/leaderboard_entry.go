package model

import "time"

type LeaderboardEntry struct {
	Rank        int       `json:"rank"`
	ScoreID     int64     `json:"scoreId"`
	DisplayName *string   `json:"displayName,omitempty"`
	AverageMs   int       `json:"averageMs"`
	BestMs      int       `json:"bestMs"`
	TotalRounds int       `json:"totalRounds"`
	Missclicks  int       `json:"missclicks"`
	CreatedAt   time.Time `json:"createdAt"`
}
