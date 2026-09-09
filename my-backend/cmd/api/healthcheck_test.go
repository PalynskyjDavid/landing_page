package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckHealth(t *testing.T) {
	for _, status := range []int{200, 301, 503} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(status)
		}))
		err := checkHealth(context.Background(), server.URL)
		server.Close()
		if (err == nil) != (status == 200) {
			t.Fatalf("status %d: unexpected error %v", status, err)
		}
	}
}

func TestCheckHealthHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := checkHealth(ctx, "http://127.0.0.1:1/health/ready"); err == nil {
		t.Fatal("cancelled probe succeeded")
	}
}
