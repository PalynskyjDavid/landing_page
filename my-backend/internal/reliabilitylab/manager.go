// Package reliabilitylab controls only the separate, local reliability demo.
// It is not registered on the game's public API.
package reliabilitylab

import (
	"context"
	"errors"
	"math"
	"sync"
	"time"
)

const (
	Window             = 10 * time.Minute
	Cooldown           = 30 * time.Second
	TimedDuration      = 30 * time.Second
	ManualDuration     = 60 * time.Second
	MaxStops           = 3
	MaxReservedSeconds = 90
)

type Service string

const (
	API Service = "api"
	DB  Service = "db"
)

func validService(service Service) bool { return service == API || service == DB }

type ServiceStatus struct {
	Running bool `json:"running"`
	Healthy bool `json:"healthy"`
}

type Driver interface {
	Inspect(context.Context, Service) (ServiceStatus, error)
	Stop(context.Context, Service) error
	Start(context.Context, Service) error
}

type Store interface {
	Load() (State, error)
	Save(State) error
}

type Reservation struct {
	At      time.Time `json:"at"`
	Seconds int       `json:"seconds"`
}

type Outage struct {
	Service    Service   `json:"service"`
	Mode       string    `json:"mode"`
	RestoreAt  time.Time `json:"restoreAt"`
	Recovering bool      `json:"recovering"`
}

type Event struct {
	At      time.Time `json:"at"`
	Service Service   `json:"service"`
	Action  string    `json:"action"`
}

type State struct {
	Version       int           `json:"version"`
	Reservations  []Reservation `json:"reservations"`
	Active        *Outage       `json:"active"`
	CooldownUntil time.Time     `json:"cooldownUntil"`
	UpdatedAt     time.Time     `json:"updatedAt"`
	Events        []Event       `json:"events"`
}

type Limits struct {
	WindowSeconds      int `json:"windowSeconds"`
	MaxStops           int `json:"maxStops"`
	MaxReservedSeconds int `json:"maxReservedSeconds"`
	CooldownSeconds    int `json:"cooldownSeconds"`
	TimedSeconds       int `json:"timedSeconds"`
	ManualSeconds      int `json:"manualSeconds"`
}

type Snapshot struct {
	Kind            string                    `json:"kind"`
	ServerTime      time.Time                 `json:"serverTime"`
	Limits          Limits                    `json:"limits"`
	UsedStops       int                       `json:"usedStops"`
	ReservedSeconds int                       `json:"reservedSeconds"`
	Services        map[Service]ServiceStatus `json:"services"`
	Outage          *Outage                   `json:"outage"`
	CooldownUntil   time.Time                 `json:"cooldownUntil"`
	BlockedReason   string                    `json:"blockedReason"`
	CanStopTimed    bool                      `json:"canStopTimed"`
	CanStopManual   bool                      `json:"canStopManual"`
	Events          []Event                   `json:"events"`
}

type Rejection struct {
	Code       string
	Status     int
	RetryAfter int
}

func (e *Rejection) Error() string { return e.Code }

type Manager struct {
	commands      sync.Mutex
	mu            sync.Mutex
	driver        Driver
	store         Store
	now           func() time.Time
	state         State
	services      map[Service]ServiceStatus
	unavailable   bool
	storageFailed bool
}

func NewManager(ctx context.Context, driver Driver, store Store, now func() time.Time) (*Manager, error) {
	state, err := store.Load()
	if err != nil {
		// Never reset a corrupt budget to zero. Attempt safe restoration, then
		// refuse to expose controls until the operator fixes the state file.
		for _, service := range []Service{DB, API} {
			if startErr := driver.Start(ctx, service); startErr != nil {
				err = errors.Join(err, startErr)
			}
		}
		return nil, err
	}
	m := &Manager{driver: driver, store: store, now: now, state: state, services: map[Service]ServiceStatus{}}
	if m.state.Active != nil {
		// Never resume an interruption after a controller restart.
		m.state.Active.Recovering = true
		m.event(m.state.Active.Service, "controller_recovery")
		_ = m.persist()
	}
	m.Tick(ctx)
	return m, nil
}

func (m *Manager) event(service Service, action string) {
	m.state.Events = append(m.state.Events, Event{At: m.now(), Service: service, Action: action})
	if len(m.state.Events) > 20 {
		m.state.Events = m.state.Events[len(m.state.Events)-20:]
	}
}

func (m *Manager) persist() error {
	m.state.UpdatedAt = m.now()
	err := m.store.Save(m.state)
	m.storageFailed = err != nil
	return err
}

func (m *Manager) usage() (int, int) {
	count, seconds := 0, 0
	cutoff := m.now().Add(-Window)
	for _, entry := range m.state.Reservations {
		if entry.At.After(cutoff) {
			count++
			seconds += entry.Seconds
		}
	}
	return count, seconds
}

func (m *Manager) rejection(duration time.Duration) *Rejection {
	now := m.now()
	if now.Before(m.state.UpdatedAt) {
		return &Rejection{Code: "clock_changed", Status: 503}
	}
	if m.storageFailed {
		return &Rejection{Code: "storage_unavailable", Status: 503}
	}
	if m.state.Active != nil {
		return &Rejection{Code: "outage_active", Status: 409}
	}
	if m.unavailable || !m.services[API].Healthy || !m.services[DB].Healthy {
		return &Rejection{Code: "services_not_ready", Status: 503}
	}
	if now.Before(m.state.CooldownUntil) {
		return &Rejection{Code: "cooldown", Status: 429, RetryAfter: int(math.Ceil(m.state.CooldownUntil.Sub(now).Seconds()))}
	}
	count, used := m.usage()
	if count >= MaxStops || used+int(duration.Seconds()) > MaxReservedSeconds {
		// Conservative Retry-After: all reservations have expired by this time.
		retry := 1
		for _, entry := range m.state.Reservations {
			retry = max(retry, int(math.Ceil(entry.At.Add(Window).Sub(now).Seconds())))
		}
		return &Rejection{Code: "budget_exhausted", Status: 429, RetryAfter: retry}
	}
	return nil
}

func (m *Manager) Snapshot() Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	count, seconds := m.usage()
	s := Snapshot{
		Kind: "isolated-reliability-lab", ServerTime: m.now(),
		Limits:    Limits{int(Window.Seconds()), MaxStops, MaxReservedSeconds, int(Cooldown.Seconds()), int(TimedDuration.Seconds()), int(ManualDuration.Seconds())},
		UsedStops: count, ReservedSeconds: seconds,
		Services:      map[Service]ServiceStatus{API: m.services[API], DB: m.services[DB]},
		CooldownUntil: m.state.CooldownUntil,
		CanStopTimed:  m.rejection(TimedDuration) == nil,
		CanStopManual: m.rejection(ManualDuration) == nil,
		Events:        append([]Event{}, m.state.Events...),
	}
	if m.state.Active != nil {
		copy := *m.state.Active
		s.Outage = &copy
	}
	if reason := m.rejection(TimedDuration); reason != nil {
		s.BlockedReason = reason.Code
	}
	return s
}

func (m *Manager) Stop(ctx context.Context, service Service, mode string) error {
	if !validService(service) || (mode != "timed" && mode != "manual") {
		return &Rejection{Code: "invalid_command", Status: 400}
	}
	// Concurrent clicks are rejected instead of waiting and scheduling another outage.
	if !m.commands.TryLock() {
		return &Rejection{Code: "operation_in_progress", Status: 409}
	}
	defer m.commands.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if ctx.Err() != nil {
		return &Rejection{Code: "operation_failed", Status: 503}
	}
	duration := TimedDuration
	if mode == "manual" {
		duration = ManualDuration
	}
	m.inspect(ctx)
	if reason := m.rejection(duration); reason != nil {
		return reason
	}
	now := m.now()
	recent := make([]Reservation, 0, MaxStops)
	previous := m.state
	previous.Events = append([]Event{}, m.state.Events...)
	for _, entry := range m.state.Reservations {
		if entry.At.After(now.Add(-Window)) {
			recent = append(recent, entry)
		}
	}
	m.state.Reservations = append(recent, Reservation{At: now, Seconds: int(duration.Seconds())})
	m.state.Active = &Outage{Service: service, Mode: mode, RestoreAt: now.Add(duration)}
	m.event(service, "stop_requested")
	// Commit the deadline and entire allowance BEFORE the Docker side effect.
	// Early starts and failed stop attempts do not refund this reservation.
	if err := m.persist(); err != nil {
		// No Docker action was attempted. Retain the old budget in memory too;
		// storageFailed still prevents new stops until persistence is repaired.
		m.state = previous
		return &Rejection{Code: "storage_unavailable", Status: 503}
	}
	if err := m.driver.Stop(ctx, service); err != nil {
		m.state.Active.Recovering = true
		m.event(service, "restore_requested")
		_ = m.persist()
		m.recover(ctx)
		return &Rejection{Code: "operation_failed", Status: 503}
	}
	m.event(service, "stopped")
	_ = m.persist()
	m.inspect(ctx)
	return nil
}

func (m *Manager) Start(ctx context.Context, service Service) error {
	if !validService(service) {
		return &Rejection{Code: "invalid_command", Status: 400}
	}
	// Recovery may wait for a stop/health inspection, but must not be rejected
	// simply because the ticker currently holds the state mutex.
	m.commands.Lock()
	defer m.commands.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if ctx.Err() != nil {
		return &Rejection{Code: "operation_failed", Status: 503}
	}
	// Recovery is never rejected because an outage allowance/cooldown is exhausted.
	if m.state.Active != nil && m.state.Active.Service == service {
		m.state.Active.Recovering = true
		m.event(service, "restore_requested")
		_ = m.persist()
		m.recover(ctx)
	} else {
		if err := m.driver.Start(ctx, service); err != nil {
			return &Rejection{Code: "operation_failed", Status: 503}
		}
		m.inspect(ctx)
	}
	if m.unavailable {
		return &Rejection{Code: "operation_failed", Status: 503}
	}
	return nil
}

func (m *Manager) inspect(ctx context.Context) {
	m.unavailable = false
	for _, service := range []Service{DB, API} {
		status, err := m.driver.Inspect(ctx, service)
		if err != nil {
			m.unavailable = true
		}
		m.services[service] = status
	}
}

func (m *Manager) recover(ctx context.Context) {
	active := m.state.Active
	if active == nil {
		return
	}
	if err := m.driver.Start(ctx, active.Service); err != nil {
		m.unavailable = true
		return // Keep the durable lease; the next tick tries again.
	}
	m.inspect(ctx)
	if m.unavailable || !m.services[API].Healthy || !m.services[DB].Healthy {
		return
	}
	m.event(active.Service, "recovered")
	m.state.Active = nil
	m.state.CooldownUntil = m.now().Add(Cooldown)
	_ = m.persist()
}

// Tick is owned by the independent controller, never by a browser timer.
func (m *Manager) Tick(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if active := m.state.Active; active != nil && (active.Recovering || !m.now().Before(active.RestoreAt)) {
		if !active.Recovering {
			active.Recovering = true
			m.event(active.Service, "automatic_restore")
			_ = m.persist()
		}
		m.recover(ctx)
	} else {
		m.inspect(ctx)
	}
}

func (m *Manager) RestoreOnShutdown(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.state.Active != nil {
		m.state.Active.Recovering = true
		m.event(m.state.Active.Service, "controller_recovery")
		_ = m.persist()
		m.recover(ctx)
	}
}
