package reaction

import "time"

type Summary struct {
	ID                int        `json:"-"`
	TotalGames        int64      `json:"totalGames"`
	AverageReactionMs float64    `json:"averageReactionMs"`
	BestAverageMs     int        `json:"bestAverageMs"`
	WorstAverageMs    int        `json:"worstAverageMs"`
	AverageMissclicks float64    `json:"averageMissclicks"`
	SourceUpdatedAt   *time.Time `json:"-"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}
