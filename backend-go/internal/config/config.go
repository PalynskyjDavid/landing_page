package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                     string
	APIPort                    string
	DatabaseURL                string
	LogLevel                   string
	CORSOrigin                 string
	StatsUpdateIntervalSeconds int
	StatsUpdateInterval        time.Duration
	ShutdownTimeoutSeconds     int
	ShutdownTimeout            time.Duration
}

type lookupFunc func(string) (string, bool)

// godotenv.Overload - can overwrite .env file variables
func Load() (Config, error) {
	_ = godotenv.Load(".env", "../.env")
	return LoadFromLookup(os.LookupEnv)
}

func LoadFromLookup(lookup lookupFunc) (Config, error) {
	cfg := Config{
		AppEnv:     getString(lookup, "APP_ENV", "development"),
		APIPort:    getString(lookup, "API_PORT", "3000"),
		LogLevel:   getString(lookup, "LOG_LEVEL", "info"),
		CORSOrigin: getString(lookup, "CORS_ORIGIN", ""),
	}

	databaseURL, ok := lookup("DATABASE_URL")
	if !ok || databaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	cfg.DatabaseURL = databaseURL

	statsIntervalSeconds, err := getPositiveInt(lookup, "STATS_UPDATE_INTERVAL_SECONDS", 60)
	if err != nil {
		return Config{}, err
	}
	cfg.StatsUpdateIntervalSeconds = statsIntervalSeconds
	cfg.StatsUpdateInterval = time.Duration(statsIntervalSeconds) * time.Second

	shutdownTimeoutSeconds, err := getPositiveInt(lookup, "SHUTDOWN_TIMEOUT_SECONDS", 10)
	if err != nil {
		return Config{}, err
	}
	cfg.ShutdownTimeoutSeconds = shutdownTimeoutSeconds
	cfg.ShutdownTimeout = time.Duration(shutdownTimeoutSeconds) * time.Second

	return cfg, nil
}

func getString(lookup lookupFunc, key string, fallback string) string {
	if value, ok := lookup(key); ok && value != "" {
		return value
	}

	return fallback
}

func getPositiveInt(lookup lookupFunc, key string, fallback int) (int, error) {
	value, ok := lookup(key)
	if !ok || value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero", key)
	}

	return parsed, nil
}

// 											Notes
// Other places env vars can come from:

// your terminal session
// Docker Compose environment:
// OS-level user/system variables
// CI/CD environment
// container runtime env
