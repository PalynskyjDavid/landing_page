package reaction

import "time"

type Result struct {
	ID          int64     `json:"id"`
	TotalRounds int       `json:"totalRounds"`
	Times       []int     `json:"times"`
	Missclicks  int       `json:"missclicks"`
	AverageMs   int       `json:"averageMs"`
	SessionID   *string   `json:"sessionId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}
