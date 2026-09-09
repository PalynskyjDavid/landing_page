package telemetry

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeWriter struct {
	fail    bool
	batches []Batch
}

func (w *fakeWriter) WriteBatch(_ context.Context, b Batch, _ string, _ time.Time, _ int64) error {
	w.batches = append(w.batches, b)
	if w.fail {
		return errors.New("offline")
	}
	return nil
}
func (*fakeWriter) Prune(context.Context) error { return nil }

func TestParseEventBoundsAndPrivacy(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 30, 0, time.UTC)
	valid := `<190>Sep 9 12:00:30 metrics: {"v":1,"route":"<unmatched>","method":"GET","status":"404","seconds":"0.015"}`
	event, err := ParseEvent([]byte(valid), now)
	if err != nil || event.DurationMS != 15 || event.Status != 404 || !event.Minute.Equal(now.Truncate(time.Minute)) {
		t.Fatalf("event=%+v err=%v", event, err)
	}
	for _, bad := range []string{
		strings.Replace(valid, "<unmatched>", "/secret", 1), strings.Replace(valid, "0.015", "NaN", 1), strings.Replace(valid, "404", "999", 1),
		strings.Replace(valid, `"v":1`, `"cookie":"secret","v":1`, 1), valid + `{}`, strings.Repeat("x", 1025),
	} {
		if _, err := ParseEvent([]byte(bad), now); err == nil {
			t.Fatalf("accepted invalid packet: %.30s", bad)
		}
	}
}
func TestCollectorRetriesBatchWithoutChangingIDAndBoundsBuffer(t *testing.T) {
	writer := &fakeWriter{fail: true}
	collector, err := NewCollector(writer)
	if err != nil {
		t.Fatal(err)
	}
	event := Event{Key: Key{time.Now().UTC().Truncate(time.Minute), "/scores", "POST"}, Status: 429, DurationMS: 12}
	collector.Record(event)
	if err := collector.Flush(t.Context()); err == nil {
		t.Fatal("expected storage failure")
	}
	id := writer.batches[0].ID
	collector.Record(event)
	writer.fail = false
	if err := collector.Flush(t.Context()); err != nil {
		t.Fatal(err)
	}
	if writer.batches[1].ID != id || len(collector.pending) != 0 {
		t.Fatal("retry changed identity or did not drain")
	}
	if writer.batches[1].Rows[event.Key].RateLimited != 1 {
		t.Fatal("wrong aggregation")
	}
	writer.fail = true
	for range maxPendingBatches + 3 {
		collector.Record(event)
		_ = collector.Flush(t.Context())
	}
	if len(collector.pending) != maxPendingBatches || collector.Dropped.Load() != 3 {
		t.Fatalf("queue=%d dropped=%d", len(collector.pending), collector.Dropped.Load())
	}
	writer.fail = false
	if err := collector.Drain(t.Context()); err != nil || len(collector.pending) != 0 {
		t.Fatalf("shutdown must drain more than one tick: pending=%d err=%v", len(collector.pending), err)
	}
	cancelled, cancel := context.WithCancel(t.Context())
	cancel()
	if !errors.Is(collector.Drain(cancelled), context.Canceled) {
		t.Fatal("shutdown must respect its deadline")
	}
}
