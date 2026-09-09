package model

import "time"

type Result struct {
	ID           int64     `json:"id"`
	SubmissionID string    `json:"submissionId"`
	PlayerID     string    `json:"playerId"`
	TotalRounds  int       `json:"totalRounds"`
	Times        []int     `json:"times"`
	Missclicks   int       `json:"missclicks"`
	AverageMs    int       `json:"averageMs"`
	DisplayName  *string   `json:"displayName,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Full model/object which will be stored.
