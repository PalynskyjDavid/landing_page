package results

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/palyndav/my-backend/internal/apperror"
)

//go:embed sql/postgres_statistics.sql
var postgresStatisticsSQL string

// Only hard-coded SQL fragments enter ORDER BY. User values stay parameters.
func statisticsOrder(selection LeaderboardSort) (string, error) {
	columns := map[LeaderboardSortField]string{
		leaderboardSortAverageMs:  "average_ms",
		leaderboardSortMissclicks: "missclicks",
		leaderboardSortBestMs:     "best_ms",
		"games":                   "games",
		"createdAt":               "created_at",
	}
	column, ok := columns[selection.Field]
	if !ok || !isSupportedLeaderboardSortDirection(selection.Direction) {
		return "", invalidStatisticsFilter("Unsupported statistics sort column or direction.")
	}
	direction := " ASC"
	if selection.Direction == leaderboardSortWorst {
		direction = " DESC"
	}
	return column + direction, nil
}

func (r *PostgresRepository) ReadStatistics(ctx context.Context, params StatisticsParams) (*Statistics, error) {
	primary, err := statisticsOrder(params.PrimarySort)
	if err != nil {
		return nil, err
	}
	secondary, err := statisticsOrder(params.SecondarySort)
	if err != nil {
		return nil, err
	}
	query := strings.ReplaceAll(postgresStatisticsSQL, "/*ORDER*/", primary+", "+secondary+", created_at ASC, id ASC")
	grouping := statisticsGamesSQL
	if params.Group == "players" {
		grouping = statisticsPlayersSQL
	}
	query = strings.ReplaceAll(query, "/*GROUP*/", grouping)
	var payload []byte
	err = r.db.QueryRow(ctx, query, pgx.NamedArgs{
		"limit": params.Limit, "player_id": params.PlayerID, "since": params.Since,
		"until": params.Until, "player": params.Player, "min_games": params.MinGames,
		"min_average": params.MinAverageMs, "max_average": params.MaxAverageMs,
		"min_best": params.MinBestMs, "max_best": params.MaxBestMs,
		"min_missclicks": params.MinMissclicks, "max_missclicks": params.MaxMissclicks,
	}).Scan(&payload)
	if err != nil {
		return nil, apperror.Internal("statistics_query_failed", "Failed to load statistics.", err)
	}
	var result Statistics
	if err := json.Unmarshal(payload, &result); err != nil {
		return nil, apperror.Internal("statistics_decode_failed", "Failed to load statistics.", fmt.Errorf("decode statistics: %w", err))
	}
	if result.Entries == nil {
		result.Entries = []StatisticsEntry{}
	}
	for index := range result.Entries {
		result.Entries[index].Rank = index + 1
	}
	return &result, nil
}

const statisticsGamesSQL = `
SELECT id, player_id, display_name, average_ms, average_ms::bigint AS average_total,
       average_ms AS best_average_ms, best_ms, missclicks, 1::bigint AS games,
       total_rounds::bigint, created_at
FROM filtered`

const statisticsPlayersSQL = `
SELECT MIN(id) AS id, player_id,
       (array_agg(display_name ORDER BY created_at DESC, id DESC))[1] AS display_name,
       FLOOR(AVG(average_ms))::integer AS average_ms,
       SUM(average_ms::bigint) AS average_total,
       MIN(average_ms) AS best_average_ms, MIN(best_ms) AS best_ms,
       AVG(missclicks) AS missclicks, COUNT(*) AS games,
       SUM(total_rounds::bigint) AS total_rounds, MAX(created_at) AS created_at
FROM filtered GROUP BY player_id`
