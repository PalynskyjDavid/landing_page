package results

import (
	"net/http"
	"strconv"
	"time"
)

func parseStatisticsOptions(r *http.Request) (StatisticsOptions, error) {
	leaderboard, err := parseLeaderboardOptions(r)
	if err != nil {
		return StatisticsOptions{}, err
	}
	query := r.URL.Query()
	options := StatisticsOptions{
		LeaderboardOptions: leaderboard, Scope: query.Get("scope"),
		Period: query.Get("period"), Group: query.Get("group"), Player: query.Get("player"),
	}
	for name, dest := range map[string]**int{
		"minAverageMs": &options.MinAverageMs, "maxAverageMs": &options.MaxAverageMs,
		"minBestMs": &options.MinBestMs, "maxBestMs": &options.MaxBestMs,
		"minMissclicks": &options.MinMissclicks, "maxMissclicks": &options.MaxMissclicks,
	} {
		if raw := query.Get(name); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil {
				return options, invalidStatisticsFilter(name + " must be an integer.")
			}
			*dest = &value
		}
	}
	if raw := query.Get("minGames"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return options, invalidStatisticsFilter("minGames must be an integer.")
		}
		if value == 0 {
			return options, invalidStatisticsFilter("minGames must be positive.")
		}
		options.MinGames = value
	}
	for name, dest := range map[string]**time.Time{"from": &options.From, "to": &options.To} {
		if raw := query.Get(name); raw != "" {
			value, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				return options, invalidStatisticsFilter(name + " must be an RFC3339 timestamp.")
			}
			*dest = &value
		}
	}
	return options, nil
}
