Docker starts Postgres.
Postgres is created with database name, app user, password, access roles... from env variables.
Optional init SQL/scripts create extra roles, extensions, or privileges.
Your app or a separate migration step runs migrations and creates tables.



save files in utf-8 for code, sql...



dc .\my-backend\
go mod init github.com/palyndav/my-backend
go test ./internal/games/reaction/results
go test ./cmd/api
go test ./...




handler - takes care of HTTP
service - handles routing
repository - manages SQL
apperror - shared error logic (important to separate message for server(log)/user(error message))


response.go should log error into db when internal error occurs?

repository.go talks to db, runs sql, maps db to structs

service.go contains business logic


project/

    cmd/ - app entry point
        api/ - for FE, fast API
            main.go - booting up the app, background jobs, loads config, initializes logger, db connection, builds router...
        worker/ - for task heavy requests, /api can send OK and pass heavy tasks to worker
            main.go - mainly background jobs

    migrations/ - initial db schema, can this set up roles and permissions or should I do that before and then migrate?
        001_insert_example_data.sql


    internal/ - contains private modules, each has its scope and solves some problem

        apperror/ - shared errors for the project
            error.go - standardies errors, mapping error to response code...

        config/ - "github.com/caarlos0/env/v11"
            config.go - loads enviroment variables

        /database - 
            /postgresql -
                postgres.go - db connection

        /platform
            /transport
                /http
                    middleware.go - CORS, rate limiting, sanitization?, before request is passed to business logic
                    response.go - what is difference between response.go and error.go?
                    response.go -
                /grpc...
            /log
                logger.go - ?custom logger dle env promenne?



        /games
            /reaction
                /stats
                    transport/handler.go - reads request, transport level validation, reads/w json, service call, map (service) output to error or response, NO sql or business logic, "single function for one route"
                    service.go - business validation, cheating check, calculations
                    repository.go - business uses CRUD on DB
                    types.go - local model "helper"
                    stats.go - model, if used only in this package
                    queries.go -
                    /sql
                        get_summary.sql
                        rebuild_summary.sql
                        + (run_agregations.sql) for worker.go? 
                    worker.go
                /results
                    handler.go
                    service.go
                    repository.go
                    types.go
                    results.go
                    queries.go
                    /sql
                        insert_result.sql
                    /model - for sharing models to other packages
                        result.go
                    worker.go


    /tests
        /integration

    /docker
        /postgres
            /init - should this also create db or go migrations and dbconnection handles that?
                001_roles.sql
                002_extensions.sql


unit test in same folder
integration tests in project/tests

handler -> transport

vecic mimo domenu vidi jenom interface a volaji neco

/transport/http - grpc - neco ruzneho


