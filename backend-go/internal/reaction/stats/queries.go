package stats

import _ "embed"

var (
	//go:embed sql/get_summary.sql
	getSummarySQL string

	//go:embed sql/rebuild_summary.sql
	rebuildSummarySQL string
)
