package reliabilitylab

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type probeTransport func(*http.Request) (*http.Response, error)

func (f probeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestHealthDistinguishesLivenessReadinessAndConnectionFailure(t *testing.T) {
	m := NewHealthMonitor()
	var calls atomic.Int32
	m.client.Transport = probeTransport(func(r *http.Request) (*http.Response, error) {
		calls.Add(1)
		if r.URL.Host != "127.0.0.1:3117" || r.Header.Get("Cookie") != "" {
			t.Errorf("unexpected target or credentials: %v", r)
		}
		status := 200
		if r.URL.Path == "/health/ready" {
			status = 503
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader("{}")), Header: http.Header{}}, nil
	})
	m.sample(context.Background())
	for range 5 {
		sample := m.Snapshot().Samples[0]
		if sample.Live.Status != 200 || sample.Ready.Status != 503 || sample.Ready.LatencyMS == nil {
			t.Fatal(sample)
		}
	}
	if calls.Load() != 2 {
		t.Fatal("reading history generated probes")
	}
	m.client.Transport = probeTransport(func(_ *http.Request) (*http.Response, error) {
		return nil, errors.New("connection refused")
	})
	m.sample(context.Background())
	sample := m.Snapshot().Samples[1]
	if sample.Live.Status != 0 || sample.Live.LatencyMS != nil || sample.Ready.Status != 0 {
		t.Fatal("failed connection must not become a zero-ms response", sample)
	}
}

func TestHealthHistoryIsBoundedCopiedAndExpires(t *testing.T) {
	m := NewHealthMonitor()
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	m.now = func() time.Time { return now }
	for range 500 {
		m.record(HealthSample{At: now})
	}
	snapshot := m.Snapshot()
	if len(snapshot.Samples) != healthCapacity {
		t.Fatal(len(snapshot.Samples))
	}
	snapshot.Samples[0].Live.Status = 999
	if m.Snapshot().Samples[0].Live.Status == 999 {
		t.Fatal("snapshot mutated history")
	}
	now = now.Add(healthWindow + time.Second)
	if len(m.Snapshot().Samples) != 0 {
		t.Fatal("stale history retained")
	}
	m.record(HealthSample{At: now})
	if len(m.Snapshot().Samples) != 1 {
		t.Fatal("record did not prune old samples")
	}
}

func TestHealthCancellationAndRedirectSafety(t *testing.T) {
	m := NewHealthMonitor()
	if m.client.Timeout != 2*time.Second || m.client.Transport.(*http.Transport).Proxy != nil {
		t.Fatal("unbounded or proxied probes")
	}
	if m.client.CheckRedirect(nil, nil) != http.ErrUseLastResponse {
		t.Fatal("redirects allowed")
	}
	started := make(chan struct{}, 2)
	m.client.Transport = probeTransport(func(r *http.Request) (*http.Response, error) {
		started <- struct{}{}
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { m.Run(ctx); close(done) }()
	for range 2 {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("probes must run concurrently")
		}
	}
	if len(m.Snapshot().Samples) != 0 {
		t.Fatal("incomplete probe recorded")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("monitor did not shut down")
	}
	if len(m.Snapshot().Samples) != 0 {
		t.Fatal("shutdown recorded as outage")
	}
}
