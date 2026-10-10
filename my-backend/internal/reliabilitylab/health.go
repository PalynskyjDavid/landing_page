package reliabilitylab

import (
	"context"
	"net/http"
	"sync"
	"time"
)

const healthInterval = 2 * time.Second
const healthWindow = 5 * time.Minute
const healthCapacity = int(healthWindow/healthInterval) + 1

// Status is zero and LatencyMS is nil when no HTTP response was received.
// A 503 is a measured response, not a successful readiness check.
type ProbeResult struct {
	Status    int      `json:"status"`
	LatencyMS *float64 `json:"latencyMs"`
}

type HealthSample struct {
	At    time.Time   `json:"at"`
	Live  ProbeResult `json:"live"`
	Ready ProbeResult `json:"ready"`
}

type HealthSnapshot struct {
	Kind            string         `json:"kind"`
	ServerTime      time.Time      `json:"serverTime"`
	StartedAt       time.Time      `json:"startedAt"`
	WindowSeconds   int            `json:"windowSeconds"`
	IntervalSeconds int            `json:"intervalSeconds"`
	Samples         []HealthSample `json:"samples"`
}

// HealthMonitor has no Docker access or shared lock with Manager. A slow probe
// cannot delay the recovery timer. GET requests only read the bounded history;
// opening more browser tabs does not generate additional backend probes.
type HealthMonitor struct {
	mu        sync.Mutex
	client    *http.Client
	now       func() time.Time
	startedAt time.Time
	samples   []HealthSample
}

func NewHealthMonitor() *HealthMonitor {
	return &HealthMonitor{
		client: &http.Client{
			Timeout: 2 * time.Second,
			// Never follow redirects or proxy environment variables to other hosts.
			Transport: &http.Transport{MaxIdleConnsPerHost: 2},
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		now: time.Now, startedAt: time.Now().UTC(), samples: []HealthSample{},
	}
}

func (m *HealthMonitor) Run(ctx context.Context) {
	ticker := time.NewTicker(healthInterval)
	defer ticker.Stop()
	defer m.client.CloseIdleConnections()
	for {
		m.sample(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *HealthMonitor) probe(ctx context.Context, path string) ProbeResult {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:3117/health/"+path, nil)
	if err != nil {
		return ProbeResult{}
	}
	start := time.Now()
	response, err := m.client.Do(req)
	if err != nil {
		return ProbeResult{}
	}
	defer func() { _ = response.Body.Close() }()
	// Header latency only; never download or retain health response bodies.
	elapsed := float64(time.Since(start).Microseconds()) / 1000
	return ProbeResult{Status: response.StatusCode, LatencyMS: &elapsed}
}

func (m *HealthMonitor) sample(ctx context.Context) {
	if ctx.Err() != nil {
		return
	}
	var live, ready ProbeResult
	var work sync.WaitGroup
	work.Go(func() { live = m.probe(ctx, "live") })
	work.Go(func() { ready = m.probe(ctx, "ready") })
	work.Wait()
	if ctx.Err() != nil {
		return // shutdown is not an API outage
	}
	// Timestamp the completed pair. No overlaps: Run waits for both probes.
	m.record(HealthSample{At: m.now().UTC(), Live: live, Ready: ready})
}

func (m *HealthMonitor) record(sample HealthSample) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cutoff := sample.At.Add(-healthWindow)
	kept := m.samples[:0]
	for _, item := range m.samples {
		if !item.At.Before(cutoff) {
			kept = append(kept, item)
		}
	}
	m.samples = append(kept, sample)
	if len(m.samples) > healthCapacity {
		m.samples = m.samples[len(m.samples)-healthCapacity:]
	}
}

func (m *HealthMonitor) Snapshot() HealthSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now().UTC()
	samples := make([]HealthSample, 0, len(m.samples))
	for _, sample := range m.samples {
		if !sample.At.Before(now.Add(-healthWindow)) {
			samples = append(samples, sample)
		}
	}
	return HealthSnapshot{
		Kind: "isolated-reliability-lab", ServerTime: now, StartedAt: m.startedAt,
		WindowSeconds: int(healthWindow.Seconds()), IntervalSeconds: int(healthInterval.Seconds()), Samples: samples,
	}
}
