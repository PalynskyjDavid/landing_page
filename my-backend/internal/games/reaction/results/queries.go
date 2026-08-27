package results

import _ "embed"

var (
	//go:embed sql/insert_result.sql
	insertResultSQL string
)

// Transforms sql files into string which are later used in repository.go to execute queries.
