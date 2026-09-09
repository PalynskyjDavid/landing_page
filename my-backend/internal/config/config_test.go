package config

import (
	"testing"
	"time"

	"github.com/caarlos0/env/v11"
)

func testEnvironment() map[string]string {
	return map[string]string{
		"DATABASE_URL": "postgresql://test:test@db:5432/test?sslmode=disable",
		"POSTGRES_DB":  "test", "POSTGRES_USER": "test", "POSTGRES_PASSWORD": "test",
	}
}

func TestParseDefaults(t *testing.T) {
	cfg, err := parse(env.Options{Environment: testEnvironment()})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BACKEND_PORT != 3001 || cfg.COOKIE_SECURE || cfg.MAX_CONNS != 10 || cfg.MAX_CONN_LIFETIME != 3*time.Minute {
		t.Fatalf("unexpected defaults: port=%d secure=%v maxConns=%d lifetime=%v", cfg.BACKEND_PORT, cfg.COOKIE_SECURE, cfg.MAX_CONNS, cfg.MAX_CONN_LIFETIME)
	}
}

func TestParseContainerOverrides(t *testing.T) {
	values := testEnvironment()
	values["BACKEND_PORT"] = "3107"
	values["COOKIE_SECURE"] = "true"
	values["CORS_ORIGIN"] = "https://example.test"
	cfg, err := parse(env.Options{Environment: values})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BACKEND_PORT != 3107 || !cfg.COOKIE_SECURE || cfg.CORS_ORIGIN != "https://example.test" {
		t.Fatal("environment overrides were not applied")
	}
}

func TestParseRejectsInvalidConfiguration(t *testing.T) {
	for _, test := range []struct{ key, value string }{
		{"BACKEND_PORT", "0"}, {"BACKEND_PORT", "65536"}, {"BACKEND_PORT", "nope"},
		{"MAX_CONNS", "0"}, {"MIN_CONNS", "-1"}, {"MIN_CONNS", "11"},
		{"MAX_CONN_IDLE_TIME", "0s"}, {"MAX_CONN_LIFETIME", "-1s"},
		{"COOKIE_SECURE", "maybe"}, {"DATABASE_URL", ""},
	} {
		t.Run(test.key+"="+test.value, func(t *testing.T) {
			values := testEnvironment()
			values[test.key] = test.value
			if _, err := parse(env.Options{Environment: values}); err == nil {
				t.Fatal("expected invalid configuration to be rejected")
			}
		})
	}
	if _, err := parse(env.Options{Environment: map[string]string{}}); err == nil {
		t.Fatal("missing required environment was accepted")
	}
}
