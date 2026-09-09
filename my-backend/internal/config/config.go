package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	// The API connects using DATABASE_URL; POSTGRES_* belongs to DB provisioning.
	MAX_CONN_LIFETIME  time.Duration `env:"MAX_CONN_LIFETIME" envDefault:"3m"`
	MAX_CONN_IDLE_TIME time.Duration `env:"MAX_CONN_IDLE_TIME" envDefault:"1m"`
	MIN_CONNS          int32         `env:"MIN_CONNS" envDefault:"1"`
	MAX_CONNS          int32         `env:"MAX_CONNS" envDefault:"10"`

	// Backend
	BACKEND_PORT  int    `env:"BACKEND_PORT" envDefault:"3001"`
	DATABASE_URL  string `env:"DATABASE_URL,required"`
	COOKIE_SECURE bool   `env:"COOKIE_SECURE" envDefault:"false"`

	// One exact browser origin for local cross-origin requests; empty disables CORS.
	CORS_ORIGIN string `env:"CORS_ORIGIN"`
}

func Load() (Config, error) {
	// Relative to the process working directory, not this source file. Existing
	// process variables win; the parent .env wins over the working-directory .env.
	_ = godotenv.Load("../.env", ".env")

	return parse(env.Options{})
}

// Separate parsing from .env loading so tests never read a developer's secrets.
func parse(options env.Options) (Config, error) {
	cfg := Config{}
	if err := env.ParseWithOptions(&cfg, options); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	// envDefault also applies to an explicitly empty value. For CORS, empty has
	// meaning: disable middleware when all browser requests share one origin.
	_, originConfigured := options.Environment["CORS_ORIGIN"]
	if options.Environment == nil {
		_, originConfigured = os.LookupEnv("CORS_ORIGIN")
	}
	if !originConfigured {
		cfg.CORS_ORIGIN = "http://localhost:5173"
	}
	if cfg.BACKEND_PORT < 1 || cfg.BACKEND_PORT > 65535 {
		return Config{}, fmt.Errorf("BACKEND_PORT must be between 1 and 65535")
	}
	if strings.TrimSpace(cfg.DATABASE_URL) == "" {
		return Config{}, fmt.Errorf("DATABASE_URL must not be empty")
	}
	if cfg.CORS_ORIGIN != "" {
		origin, err := url.Parse(cfg.CORS_ORIGIN)
		if err != nil || (origin.Scheme != "http" && origin.Scheme != "https") ||
			origin.Hostname() == "" || strings.ContainsAny(origin.Host, "*,") || origin.User != nil ||
			origin.Path != "" || origin.RawQuery != "" || origin.ForceQuery || origin.Fragment != "" ||
			strings.Contains(cfg.CORS_ORIGIN, "#") {
			return Config{}, fmt.Errorf("CORS_ORIGIN must be empty or one exact HTTP(S) origin without a path, credentials, query or fragment")
		}
	}
	if cfg.MAX_CONNS < 1 || cfg.MIN_CONNS < 0 || cfg.MIN_CONNS > cfg.MAX_CONNS {
		return Config{}, fmt.Errorf("connection limits require 0 <= MIN_CONNS <= MAX_CONNS and MAX_CONNS >= 1")
	}
	if cfg.MAX_CONN_LIFETIME <= 0 || cfg.MAX_CONN_IDLE_TIME <= 0 {
		return Config{}, fmt.Errorf("connection lifetimes must be positive")
	}

	return cfg, nil
}
