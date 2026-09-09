package results

// SQLite support is intentionally not implemented.
//
// If it becomes a real requirement, this file will contain a SQLiteRepository
// with its own database driver, constructor, Create method, SQL, migrations,
// and integration tests. That adapter will satisfy Repository, while Service
// and the HTTP handler will remain unchanged.
