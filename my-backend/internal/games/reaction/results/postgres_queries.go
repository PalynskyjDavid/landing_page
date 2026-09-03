package results

import _ "embed"

//go:embed sql/postgres_insert_result.sql
var postgresInsertResultSQL string

//go:embed sql/postgres_list_leaderboard.sql
var postgresListLeaderboardSQL string
