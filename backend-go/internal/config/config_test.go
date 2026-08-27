package config

import "testing"

func TestLoadFromLookupUsesDefaultsAndRequiredValues(t *testing.T) {
	cfg, err := LoadFromLookup(func(key string) (string, bool) {
		switch key {
		case "DATABASE_URL":
			return "postgres://db", true
		default:
			return "", false
		}
	})
	if err != nil {
		t.Fatalf("expected config to load, got error: %v", err)
	}

	if cfg.APIPort != "3000" {
		t.Fatalf("expected default API_PORT 3000, got %s", cfg.APIPort)
	}
	if cfg.StatsUpdateIntervalSeconds != 60 {
		t.Fatalf("expected default stats interval of 60, got %d", cfg.StatsUpdateIntervalSeconds)
	}
}

func TestLoadFromLookupRequiresDatabaseURL(t *testing.T) {
	_, err := LoadFromLookup(func(string) (string, bool) {
		return "", false
	})
	if err == nil {
		t.Fatal("expected DATABASE_URL validation error")
	}
}

func TestLoadFromLookupRejectsInvalidInterval(t *testing.T) {
	_, err := LoadFromLookup(func(key string) (string, bool) {
		switch key {
		case "DATABASE_URL":
			return "postgres://db", true
		case "STATS_UPDATE_INTERVAL_SECONDS":
			return "0", true
		default:
			return "", false
		}
	})
	if err == nil {
		t.Fatal("expected invalid interval error")
	}
}
