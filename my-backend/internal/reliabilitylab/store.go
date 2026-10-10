package reliabilitylab

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

type FileStore struct{ Path string }

func (s FileStore) Load() (State, error) {
	data, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		state := State{Version: 1, Reservations: []Reservation{}, Events: []Event{}}
		return state, s.Save(state)
	}
	if err != nil {
		return State{}, err
	}
	if len(data) > 64*1024 {
		return State{}, errors.New("lab state exceeds its size limit")
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return State{}, err
	}
	if state.Version != 1 || len(state.Reservations) > MaxStops || len(state.Events) > 20 {
		return State{}, errors.New("invalid lab state; refusing to reset the global budget")
	}
	for _, entry := range state.Reservations {
		if entry.At.IsZero() || (entry.Seconds != 30 && entry.Seconds != 60) {
			return State{}, errors.New("invalid lab reservation")
		}
	}
	if active := state.Active; active != nil {
		if !validService(active.Service) || active.RestoreAt.IsZero() ||
			(active.Mode != "manual" && active.Mode != "timed") || len(state.Reservations) == 0 {
			return State{}, errors.New("invalid lab outage lease")
		}
	}
	return state, nil
}

func (s FileStore) Save(state State) error {
	if err := os.MkdirAll(filepath.Dir(s.Path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(s.Path), ".controller-*.tmp")
	if err != nil {
		return err
	}
	name := file.Name()
	defer func() { _ = os.Remove(name) }()
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(name, s.Path); err != nil {
		return fmt.Errorf("save lab state: %w", err)
	}
	return nil
}
