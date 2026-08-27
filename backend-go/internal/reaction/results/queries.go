package results

import _ "embed"

var (
	//go:embed sql/insert_result.sql
	insertResultSQL string
)
