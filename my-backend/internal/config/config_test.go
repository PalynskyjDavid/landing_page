package config

import (
	"testing"
	"time"

	"github.com/caarlos0/env/v11"
)

func testEnvironment() map[string]string {
	return map[string]string{
		"DATABASE_URL": "postgresql://test:test@db:5432/test?sslmode=disable",
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
	if cfg.CORS_ORIGIN != "http://localhost:5173" {
		t.Fatalf("unexpected default origin: %q", cfg.CORS_ORIGIN)
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
		{"COOKIE_SECURE", "maybe"}, {"DATABASE_URL", ""}, {"DATABASE_URL", "   "},
		{"CORS_ORIGIN", "*"}, {"CORS_ORIGIN", "https://*.example.test"},
		{"CORS_ORIGIN", "localhost:5173"}, {"CORS_ORIGIN", "ftp://example.test"},
		{"CORS_ORIGIN", "https://example.test/"}, {"CORS_ORIGIN", "https://example.test/game"},
		{"CORS_ORIGIN", "https://example.test?secret=value"}, {"CORS_ORIGIN", "https://example.test?"},
		{"CORS_ORIGIN", "https://example.test#fragment"}, {"CORS_ORIGIN", "https://example.test#"},
		{"CORS_ORIGIN", "https://name:secret@example.test"}, {"CORS_ORIGIN", "https://"},
		{"CORS_ORIGIN", "http://localhost:5173,http://localhost:5187"},
		{"CORS_ORIGIN", "https://one.test,two.test"},
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

func TestParseAcceptsExactOriginsAndDisabledCORS(t *testing.T) {
	for _, origin := range []string{"", "http://localhost:5173", "https://example.test", "http://[::1]:5173"} {
		t.Run(origin, func(t *testing.T) {
			values := testEnvironment()
			values["CORS_ORIGIN"] = origin
			cfg, err := parse(env.Options{Environment: values})
			if err != nil {
				t.Fatal(err)
			}
			if cfg.CORS_ORIGIN != origin {
				t.Fatalf("origin changed: got %q, want %q", cfg.CORS_ORIGIN, origin)
			}
		})
	}
}
