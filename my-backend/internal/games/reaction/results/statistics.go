package results

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/palyndav/my-backend/internal/apperror"
	"github.com/palyndav/my-backend/internal/platform/identifier"
)

// Statistics filters apply before ranking and before aggregation.
type StatisticsOptions struct {
	LeaderboardOptions
	Scope                        string
	Period                       string
	PlayerID                     string
	Group                        string
	Player                       string
	From, To                     *time.Time
	MinAverageMs, MaxAverageMs   *int
	MinBestMs, MaxBestMs         *int
	MinMissclicks, MaxMissclicks *int
	MinGames                     int
}

type StatisticsParams struct {
	LeaderboardParams
	PlayerID                     string
	Since                        *time.Time
	Until                        *time.Time
	Group                        string
	Player                       string
	MinAverageMs, MaxAverageMs   *int
	MinBestMs, MaxBestMs         *int
	MinMissclicks, MaxMissclicks *int
	MinGames                     int
}

type StatisticsEntry struct {
	ScoreID     int64     `json:"scoreId"`
	Rank        int       `json:"rank"`
	DisplayName *string   `json:"displayName,omitempty"`
	AverageMs   int       `json:"averageMs"`
	BestMs      int       `json:"bestMs"`
	Missclicks  float64   `json:"missclicks"`
	Games       int64     `json:"games"`
	TotalRounds int64     `json:"totalRounds"`
	CreatedAt   time.Time `json:"createdAt"`
}

type StatisticsSummary struct {
	Games         int64 `json:"games"`
	Players       int64 `json:"players"`
	AverageMs     *int  `json:"averageMs"`
	BestAverageMs *int  `json:"bestAverageMs"`
}

type Statistics struct {
	Entries []StatisticsEntry `json:"entries"`
	Summary StatisticsSummary `json:"summary"`
}

func (s *Service) Statistics(ctx context.Context, options StatisticsOptions) (*Statistics, error) {
	if options.Limit == 0 {
		options.Limit = defaultLeaderboardLimit
	}
	if options.Limit < 1 || options.Limit > maxLeaderboardLimit {
		return nil, apperror.BadRequest("score_invalid_limit", "limit must be between 1 and 50.", nil)
	}
	sort, err := normalizeStatisticsSort(options.Sort)
	if err != nil {
		return nil, err
	}
	params := StatisticsParams{LeaderboardParams: LeaderboardParams{
		Limit: options.Limit, PrimarySort: sort[0], SecondarySort: sort[1],
	}}
	switch options.Scope {
	case "", "everyone":
	case "mine":
		playerID, valid := identifier.NormalizeUUID(options.PlayerID)
		if !valid {
			return nil, apperror.BadRequest("score_invalid_player_id", "A player cookie is required.", nil)
		}
		params.PlayerID = playerID
	default:
		return nil, apperror.BadRequest("score_invalid_scope", "scope must be everyone or mine.", nil)
	}
	var days int
	switch options.Period {
	case "", "all":
	case "7d":
		days = 7
	case "30d":
		days = 30
	default:
		return nil, apperror.BadRequest("score_invalid_period", "period must be all, 7d or 30d.", nil)
	}
	if days > 0 {
		if options.From != nil || options.To != nil {
			return nil, invalidStatisticsFilter("Use a period or custom dates, not both.")
		}
		since := s.now().UTC().Add(-time.Duration(days) * 24 * time.Hour)
		params.Since = &since
	}
	if options.From != nil {
		params.Since = options.From
	}
	params.Until = options.To
	if params.Since != nil && params.Until != nil && !params.Since.Before(*params.Until) {
		return nil, invalidStatisticsFilter("from must be earlier than to.")
	}
	if options.Group == "" {
		options.Group = "games"
	}
	if options.Group != "games" && options.Group != "players" {
		return nil, invalidStatisticsFilter("group must be games or players.")
	}
	params.Group = options.Group
	params.Player = strings.TrimSpace(options.Player)
	if utf8.RuneCountInString(params.Player) > maxDisplayNameLength {
		return nil, invalidStatisticsFilter("player must be at most 24 characters.")
	}
	for _, bounds := range [][2]*int{{options.MinAverageMs, options.MaxAverageMs}, {options.MinBestMs, options.MaxBestMs}, {options.MinMissclicks, options.MaxMissclicks}} {
		for _, value := range bounds {
			if value != nil && (*value < 0 || *value > 2147483647) {
				return nil, invalidStatisticsFilter("Numeric filters must be between 0 and 2147483647.")
			}
		}
		if bounds[0] != nil && bounds[1] != nil && *bounds[0] > *bounds[1] {
			return nil, invalidStatisticsFilter("A minimum cannot exceed its maximum.")
		}
	}
	params.MinAverageMs, params.MaxAverageMs = options.MinAverageMs, options.MaxAverageMs
	params.MinBestMs, params.MaxBestMs = options.MinBestMs, options.MaxBestMs
	params.MinMissclicks, params.MaxMissclicks = options.MinMissclicks, options.MaxMissclicks
	if options.MinGames == 0 {
		options.MinGames = 1
	}
	if options.MinGames < 1 || options.MinGames > 1000000 {
		return nil, invalidStatisticsFilter("minGames must be between 1 and 1000000.")
	}
	if options.Group == "games" && options.MinGames != 1 {
		return nil, invalidStatisticsFilter("minGames applies only to player groups.")
	}
	params.MinGames = options.MinGames
	// Bound database work independently of the enclosing HTTP timeout.
	queryContext, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return s.repository.ReadStatistics(queryContext, params)
}

func invalidStatisticsFilter(message string) error {
	return apperror.BadRequest("score_invalid_filter", message, nil)
}

func normalizeStatisticsSort(input []LeaderboardSort) ([2]LeaderboardSort, error) {
	if len(input) == 0 {
		return normalizeLeaderboardSort(nil)
	}
	if len(input) > 2 {
		return [2]LeaderboardSort{}, invalidStatisticsFilter("Use at most two sort columns.")
	}
	for _, selection := range input {
		if !isSupportedStatisticsField(selection.Field) || !isSupportedLeaderboardSortDirection(selection.Direction) {
			return [2]LeaderboardSort{}, invalidStatisticsFilter("Unsupported statistics sort column or direction.")
		}
	}
	if len(input) == 2 {
		if input[0].Field == input[1].Field {
			return [2]LeaderboardSort{}, invalidStatisticsFilter("Sort columns must differ.")
		}
		return [2]LeaderboardSort{input[0], input[1]}, nil
	}
	secondary := leaderboardSortMissclicks
	if input[0].Field == secondary {
		secondary = leaderboardSortAverageMs
	}
	return [2]LeaderboardSort{input[0], {Field: secondary, Direction: leaderboardSortBest}}, nil
}

func isSupportedStatisticsField(field LeaderboardSortField) bool {
	return isSupportedLeaderboardSortField(field) || field == "games" || field == "createdAt"
}
