package config

//one user for writing stats, one for reading - one for set up?

// caarlos0/env - loads and parses variables from os, docker, CI
// joho/godotenv - loads .env file into process enviroment, for development or testing
import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	// Postgres + settings
	POSTGRES_DB       string `env:"POSTGRES_DB,required"`
	POSTGRES_USER     string `env:"POSTGRES_USER,required"`
	POSTGRES_PASSWORD string `env:"POSTGRES_PASSWORD,required"`

	MAX_CONN_LIFETIME  time.Duration `env:"MAX_CONN_LIFETIME" envDefault:"3m"`
	MAX_CONN_IDLE_TIME time.Duration `env:"MAX_CONN_IDLE_TIME" envDefault:"1m"`
	MIN_CONNS          int32         `env:"MIN_CONNS" envDefault:"1"`
	MAX_CONNS          int32         `env:"MAX_CONNS" envDefault:"10"`

	// Backend
	BACKEND_PORT  int    `env:"BACKEND_PORT" envDefault:"3001"`
	DATABASE_URL  string `env:"DATABASE_URL,required"`
	COOKIE_SECURE bool   `env:"COOKIE_SECURE" envDefault:"false"`

	// Frontend
	CORS_ORIGIN string `env:"CORS_ORIGIN" envDefault:"http://localhost:5173"`
}

func Load() (Config, error) {
	// path starts at "./cmd/api/main.go"
	_ = godotenv.Load("../.env", ".env")

	return parse(env.Options{})
}

// Separate parsing from .env loading so tests never read a developer's secrets.
func parse(options env.Options) (Config, error) {
	cfg := Config{}
	if err := env.ParseWithOptions(&cfg, options); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if cfg.BACKEND_PORT < 1 || cfg.BACKEND_PORT > 65535 {
		return Config{}, fmt.Errorf("BACKEND_PORT must be between 1 and 65535")
	}
	if cfg.DATABASE_URL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL must not be empty")
	}
	if cfg.MAX_CONNS < 1 || cfg.MIN_CONNS < 0 || cfg.MIN_CONNS > cfg.MAX_CONNS {
		return Config{}, fmt.Errorf("connection limits require 0 <= MIN_CONNS <= MAX_CONNS and MAX_CONNS >= 1")
	}
	if cfg.MAX_CONN_LIFETIME <= 0 || cfg.MAX_CONN_IDLE_TIME <= 0 {
		return Config{}, fmt.Errorf("connection lifetimes must be positive")
	}

	return cfg, nil
}

// I can add "Manager" struct instead of global var

// var current *config.Config
// func reloadConfig() error {
// 	cfg, err := config.Load()
// 	if err != nil {
// 		return fmt.Errorf("reload config: %w", err)
// 	}
// 	current = cfg
// 	return nil
// }
