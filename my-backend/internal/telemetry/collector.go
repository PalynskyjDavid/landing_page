package telemetry

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math"
	"net"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/palyndav/my-backend/internal/platform/identifier"
)

const FlushInterval = 5 * time.Second
const maxPendingBatches = 120 // About ten minutes; not an audit/durable queue.
const maxBucketKeys = 128

type Key struct {
	Minute time.Time
	Route  string
	Method string
}
type Counters struct {
	Requests     int64 `json:"requests"`
	ClientErrors int64 `json:"clientErrors"`
	ServerErrors int64 `json:"serverErrors"`
	NotFound     int64 `json:"notFound"`
	RateLimited  int64 `json:"rateLimited"`
	DurationMS   int64 `json:"durationMs"`
}
type Event struct {
	Key
	Status     int
	DurationMS int64
}
type Batch struct {
	ID   string
	Rows map[Key]Counters
}
type Writer interface {
	WriteBatch(context.Context, Batch, string, time.Time, int64) error
	Prune(context.Context) error
}

func KnownRoute(route string) bool {
	switch route {
	case "/scores", "/scores/leaderboard", "/scores/statistics", "<unmatched>":
		return true
	}
	return false
}

// Syslog adds a short header before the JSON. The wire format contains NO IP,
// arbitrary URL, query string, body, cookie or user identity.
func ParseEvent(packet []byte, now time.Time) (Event, error) {
	var result Event
	if len(packet) > 1024 {
		return result, errors.New("oversized telemetry datagram")
	}
	start := bytes.IndexByte(packet, '{')
	if start < 0 {
		return result, errors.New("missing telemetry JSON")
	}
	var wire struct {
		Version int    `json:"v"`
		Route   string `json:"route"`
		Method  string `json:"method"`
		Status  string `json:"status"`
		Seconds string `json:"seconds"`
	}
	decoder := json.NewDecoder(bytes.NewReader(packet[start:]))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&wire); err != nil {
		return result, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return result, errors.New("extra telemetry JSON")
	}
	status, statusErr := strconv.Atoi(wire.Status)
	seconds, durationErr := strconv.ParseFloat(wire.Seconds, 64)
	if wire.Version != 1 || !KnownRoute(wire.Route) ||
		(wire.Method != "GET" && wire.Method != "POST" && wire.Method != "OTHER") ||
		statusErr != nil || status < 100 || status > 599 || durationErr != nil ||
		math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds < 0 || seconds > 3600 {
		return result, errors.New("invalid telemetry fields")
	}
	// Receipt time avoids untrusted timestamps creating unlimited buckets.
	return Event{Key: Key{now.UTC().Truncate(time.Minute), wire.Route, wire.Method},
		Status: status, DurationMS: int64(math.Round(seconds * 1000))}, nil
}

type Collector struct {
	mu         sync.Mutex
	current    map[Key]Counters
	pending    []Batch // Only Flush owns this queue.
	Dropped    atomic.Int64
	instance   string
	started    time.Time
	writer     Writer
	lastPruned time.Time
}

func NewCollector(writer Writer) (*Collector, error) {
	id, err := identifier.NewUUID()
	if err != nil {
		return nil, err
	}
	return &Collector{current: make(map[Key]Counters), instance: id, started: time.Now().UTC(), writer: writer}, nil
}

func (c *Collector) Record(event Event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	value, exists := c.current[event.Key]
	if !exists && len(c.current) >= maxBucketKeys {
		c.Dropped.Add(1)
		return
	}
	value.Requests++
	if event.Status >= 400 && event.Status < 500 {
		value.ClientErrors++
	}
	if event.Status >= 500 {
		value.ServerErrors++
	}
	if event.Status == 404 {
		value.NotFound++
	}
	if event.Status == 429 {
		value.RateLimited++
	}
	value.DurationMS += event.DurationMS
	c.current[event.Key] = value
}

// Serial worker: never hold the receiver's mutex during database IO. A whole
// batch keeps its ID until acknowledged, including after an uncertain commit.
func (c *Collector) Flush(ctx context.Context) error {
	id, err := identifier.NewUUID()
	if err != nil {
		return err
	}
	c.mu.Lock()
	rows := c.current
	c.current = make(map[Key]Counters)
	c.mu.Unlock()
	if len(c.pending) >= maxPendingBatches {
		for _, row := range rows {
			c.Dropped.Add(row.Requests)
		}
	} else if len(rows) > 0 || len(c.pending) == 0 {
		c.pending = append(c.pending, Batch{ID: id, Rows: rows})
	}
	// Bound each tick's recovery work. New traffic remains in current meanwhile.
	for i := 0; i < 20 && len(c.pending) > 0; i++ {
		if err := c.writer.WriteBatch(ctx, c.pending[0], c.instance, c.started, c.Dropped.Load()); err != nil {
			return err
		}
		c.pending = c.pending[1:]
	}
	if time.Since(c.lastPruned) >= time.Hour {
		if err := c.writer.Prune(ctx); err != nil {
			return err
		}
		c.lastPruned = time.Now()
	}
	return nil
}

// Drain is only called after the receiver and periodic writer have stopped.
func (c *Collector) Drain(ctx context.Context) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := c.Flush(ctx); err != nil {
			return err
		}
		if len(c.pending) == 0 {
			return nil
		}
	}
}

func (c *Collector) Receive(ctx context.Context, conn net.PacketConn) error {
	buffer := make([]byte, 2048)
	for {
		if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
			return err
		}
		n, _, err := conn.ReadFrom(buffer)
		if ctx.Err() != nil {
			return nil
		}
		if err != nil {
			if timeout, ok := errors.AsType[net.Error](err); ok && timeout.Timeout() {
				continue
			}
			return err
		}
		event, err := ParseEvent(buffer[:n], time.Now())
		if err != nil {
			c.Dropped.Add(1)
			continue
		}
		c.Record(event)
	}
}

func (c *Collector) RunWriter(ctx context.Context, logger *slog.Logger) {
	ticker := time.NewTicker(FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			attempt, cancel := context.WithTimeout(ctx, 3*time.Second)
			err := c.Flush(attempt)
			cancel()
			if err != nil {
				// Avoid connection strings / SQL values in public or container diagnostics.
				logger.Warn("telemetry flush delayed", "code", "telemetry_storage_unavailable", "pending_batches", len(c.pending), "dropped_events", c.Dropped.Load())
			}
		}
	}
}
