package reliabilitylab

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

type fakeDriver struct {
	statuses                   map[Service]ServiceStatus
	stops, starts, inspections int
	stopErr, startErr          error
	beforeStop                 func()
}

func (d *fakeDriver) Inspect(_ context.Context, s Service) (ServiceStatus, error) {
	d.inspections++
	return d.statuses[s], nil
}
func (d *fakeDriver) Stop(_ context.Context, s Service) error {
	if d.beforeStop != nil {
		d.beforeStop()
	}
	d.stops++
	d.statuses[s] = ServiceStatus{}
	return d.stopErr
}
func (d *fakeDriver) Start(_ context.Context, s Service) error {
	d.starts++
	if d.startErr != nil {
		return d.startErr
	}
	d.statuses[s] = ServiceStatus{Running: true, Healthy: true}
	return nil
}

type memoryStore struct {
	state State
	fail  bool
}

func (s *memoryStore) Load() (State, error) {
	data, _ := json.Marshal(s.state)
	var copy State
	_ = json.Unmarshal(data, &copy)
	return copy, nil
}
func (s *memoryStore) Save(state State) error {
	if s.fail {
		return errors.New("disk unavailable")
	}
	data, _ := json.Marshal(state)
	return json.Unmarshal(data, &s.state)
}
func fixture(t *testing.T) (*Manager, *fakeDriver, *memoryStore, *time.Time) {
	t.Helper()
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	d := &fakeDriver{statuses: map[Service]ServiceStatus{API: {true, true}, DB: {true, true}}}
	s := &memoryStore{state: State{Version: 1}}
	m, err := NewManager(context.Background(), d, s, func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	return m, d, s, &now
}
func wantCode(t *testing.T, err error, code string) {
	t.Helper()
	var rejected *Rejection
	if !errors.As(err, &rejected) || rejected.Code != code {
		t.Fatalf("got %v, want %s", err, code)
	}
}
func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func TestTimedRecoveryAndGlobalActiveLimit(t *testing.T) {
	m, d, s, now := fixture(t)
	ctx := context.Background()
	d.beforeStop = func() {
		if s.state.Active == nil || len(s.state.Reservations) != d.stops+1 {
			t.Fatal("stop before durable reservation")
		}
	}
	must(t, m.Stop(ctx, API, "timed"))
	wantCode(t, m.Stop(ctx, DB, "timed"), "outage_active")
	if d.stops != 1 || m.Snapshot().ReservedSeconds != 30 {
		t.Fatal("global allowance incorrect")
	}
	*now = now.Add(29 * time.Second)
	m.Tick(ctx)
	if d.starts != 0 {
		t.Fatal("restored too early")
	}
	*now = now.Add(time.Second)
	m.Tick(ctx)
	status := m.Snapshot()
	if status.Outage != nil || !status.Services[API].Healthy {
		t.Fatal("did not recover")
	}
	wantCode(t, m.Stop(ctx, DB, "timed"), "cooldown")
	*now = now.Add(Cooldown)
	must(t, m.Stop(ctx, DB, "timed"))
}

func TestManualRecoveryDoesNotRefundAndBudgetExpires(t *testing.T) {
	m, _, _, now := fixture(t)
	ctx := context.Background()
	must(t, m.Stop(ctx, DB, "manual"))
	if got := m.Snapshot().Outage.RestoreAt.Sub(*now); got != ManualDuration {
		t.Fatalf("deadline %s", got)
	}
	must(t, m.Start(ctx, DB))
	if m.Snapshot().ReservedSeconds != 60 {
		t.Fatal("early recovery refunded budget")
	}
	*now = now.Add(Cooldown)
	wantCode(t, m.Stop(ctx, API, "manual"), "budget_exhausted")
	must(t, m.Stop(ctx, API, "timed"))
	must(t, m.Start(ctx, API))
	*now = now.Add(Cooldown)
	wantCode(t, m.Stop(ctx, API, "timed"), "budget_exhausted")
	if m.Snapshot().UsedStops != 2 {
		t.Fatal("rejection consumed reservation")
	}
	*now = now.Add(Window)
	must(t, m.Stop(ctx, API, "manual"))
}

func TestManualSafetyDeadline(t *testing.T) {
	m, d, _, now := fixture(t)
	ctx := context.Background()
	must(t, m.Stop(ctx, API, "manual"))
	*now = now.Add(59 * time.Second)
	m.Tick(ctx)
	if d.starts != 0 {
		t.Fatal("early recovery")
	}
	*now = now.Add(time.Second)
	m.Tick(ctx)
	if m.Snapshot().Outage != nil {
		t.Fatal("manual stop not restored")
	}
}

func TestThreeStopsAndRollingWindow(t *testing.T) {
	m, _, _, now := fixture(t)
	ctx := context.Background()
	initial := *now
	for range 3 {
		must(t, m.Stop(ctx, API, "timed"))
		must(t, m.Start(ctx, API))
		*now = now.Add(Cooldown)
	}
	wantCode(t, m.Stop(ctx, DB, "timed"), "budget_exhausted")
	if status := m.Snapshot(); status.UsedStops != 3 || status.ReservedSeconds != 90 {
		t.Fatal(status)
	}
	*now = initial.Add(Window - time.Second)
	wantCode(t, m.Stop(ctx, DB, "timed"), "budget_exhausted")
	*now = initial.Add(Window)
	must(t, m.Stop(ctx, DB, "timed"))
}

func TestRestartRestoresImmediatelyAndKeepsBudget(t *testing.T) {
	m, d, s, now := fixture(t)
	ctx := context.Background()
	must(t, m.Stop(ctx, DB, "manual"))
	restarted, err := NewManager(ctx, d, s, func() time.Time { return *now })
	must(t, err)
	status := restarted.Snapshot()
	if status.Outage != nil || status.UsedStops != 1 || status.ReservedSeconds != 60 || !status.Services[DB].Healthy {
		t.Fatal(status)
	}
	wantCode(t, restarted.Stop(ctx, API, "timed"), "cooldown")
}

func TestPersistenceFailurePreventsStopButNeverRecovery(t *testing.T) {
	m, d, s, _ := fixture(t)
	ctx := context.Background()
	s.fail = true
	wantCode(t, m.Stop(ctx, API, "timed"), "storage_unavailable")
	if d.stops != 0 || m.Snapshot().UsedStops != 0 {
		t.Fatal("stopped without durable state")
	}
	m, d, s, _ = fixture(t)
	must(t, m.Stop(ctx, API, "manual"))
	s.fail = true
	must(t, m.Start(ctx, API))
	if !d.statuses[API].Running || m.Snapshot().CanStopTimed {
		t.Fatal("unsafe storage failure behavior")
	}
}

func TestFailedStopAndFailedStartRetainRecoveryLease(t *testing.T) {
	m, d, _, now := fixture(t)
	ctx := context.Background()
	d.stopErr = errors.New("stop timed out")
	d.startErr = errors.New("daemon offline")
	wantCode(t, m.Stop(ctx, API, "timed"), "operation_failed")
	if s := m.Snapshot(); s.Outage == nil || !s.Outage.Recovering || s.ReservedSeconds != 30 {
		t.Fatal(s)
	}
	*now = now.Add(time.Second)
	m.Tick(ctx)
	if m.Snapshot().Outage == nil {
		t.Fatal("dropped unresolved outage")
	}
	d.startErr = nil
	m.Tick(ctx)
	if m.Snapshot().Outage != nil {
		t.Fatal("did not retry recovery")
	}
}

func TestConcurrentClicksDoNotQueueOutages(t *testing.T) {
	m, d, _, _ := fixture(t)
	ctx := context.Background()
	entered, release := make(chan struct{}), make(chan struct{})
	d.beforeStop = func() { close(entered); <-release }
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := m.Stop(ctx, API, "timed"); err != nil {
			t.Error(err)
		}
	}()
	<-entered
	wantCode(t, m.Stop(ctx, DB, "manual"), "operation_in_progress")
	close(release)
	wg.Wait()
	if d.stops != 1 || m.Snapshot().UsedStops != 1 {
		t.Fatal("multiple concurrent outages")
	}
}

func TestStartWaitsForAcceptedStopInsteadOfRejectingRecovery(t *testing.T) {
	m, d, _, _ := fixture(t)
	ctx := context.Background()
	entered, release := make(chan struct{}), make(chan struct{})
	d.beforeStop = func() { close(entered); <-release }
	stopped, started := make(chan error, 1), make(chan error, 1)
	go func() { stopped <- m.Stop(ctx, DB, "manual") }()
	<-entered
	go func() { started <- m.Start(ctx, DB) }()
	select {
	case err := <-started:
		close(release)
		t.Fatalf("recovery must wait for the accepted stop, not reject: %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	close(release)
	must(t, <-stopped)
	must(t, <-started)
	if m.Snapshot().Outage != nil || !d.statuses[DB].Healthy {
		t.Fatal("queued recovery did not run")
	}
}

func TestInvalidCommandsAndUnhealthyServicesRejectWithoutAction(t *testing.T) {
	m, d, _, _ := fixture(t)
	ctx := context.Background()
	for _, s := range []Service{"prod", "controller", "api; shutdown"} {
		wantCode(t, m.Stop(ctx, s, "timed"), "invalid_command")
		wantCode(t, m.Start(ctx, s), "invalid_command")
	}
	wantCode(t, m.Stop(ctx, API, "forever"), "invalid_command")
	d.statuses[DB] = ServiceStatus{Running: true}
	wantCode(t, m.Stop(ctx, API, "timed"), "services_not_ready")
	if d.stops != 0 || m.Snapshot().UsedStops != 0 {
		t.Fatal("invalid command changed state")
	}
}

func TestShutdownAndClockRollback(t *testing.T) {
	m, d, _, now := fixture(t)
	ctx := context.Background()
	must(t, m.Stop(ctx, DB, "manual"))
	m.RestoreOnShutdown(ctx)
	if !d.statuses[DB].Healthy || m.Snapshot().Outage != nil {
		t.Fatal("shutdown did not restore")
	}
	*now = now.Add(-time.Hour)
	wantCode(t, m.Stop(ctx, API, "timed"), "clock_changed")
}

func TestRecoveryWaitsForBothServicesReady(t *testing.T) {
	m, d, _, now := fixture(t)
	ctx := context.Background()
	must(t, m.Stop(ctx, API, "timed"))
	d.statuses[DB] = ServiceStatus{Running: true}
	*now = now.Add(TimedDuration)
	m.Tick(ctx)
	if active := m.Snapshot().Outage; active == nil || !active.Recovering {
		t.Fatal("cleared the outage before both services were healthy")
	}
	wantCode(t, m.Stop(ctx, API, "timed"), "outage_active")
	d.statuses[DB] = ServiceStatus{Running: true, Healthy: true}
	m.Tick(ctx)
	if m.Snapshot().Outage != nil {
		t.Fatal("did not finish recovery when both services became ready")
	}
}

func TestExpiredCommandContextDoesNotStopOrStartLater(t *testing.T) {
	m, d, _, _ := fixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	wantCode(t, m.Stop(ctx, API, "timed"), "operation_failed")
	wantCode(t, m.Start(ctx, DB), "operation_failed")
	if d.stops != 0 || d.starts != 0 || m.Snapshot().UsedStops != 0 {
		t.Fatal("performed expired command")
	}
}

func TestFileStoreRoundTripAndCorruptionFailsClosedOnDisk(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "state.json")
	store := FileStore{Path: path}
	state, err := store.Load()
	must(t, err)
	if state.Version != 1 {
		t.Fatal(state)
	}
	state.Reservations = []Reservation{{At: time.Now(), Seconds: 60}}
	state.Active = &Outage{Service: DB, Mode: "manual", RestoreAt: time.Now().Add(time.Minute)}
	must(t, store.Save(state))
	loaded, err := store.Load()
	must(t, err)
	if loaded.Active.Service != DB || loaded.Reservations[0].Seconds != 60 {
		t.Fatal(loaded)
	}
	must(t, os.WriteFile(path, []byte("broken"), 0600))
	_, d, _, _ := fixture(t)
	_, err = NewManager(context.Background(), d, store, time.Now)
	if err == nil || d.starts != 2 {
		t.Fatal("corrupt state did not restore and refuse")
	}
	data, err := os.ReadFile(path)
	must(t, err)
	if string(data) != "broken" {
		t.Fatal("silently reset corrupt budget")
	}
}
