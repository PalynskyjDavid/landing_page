package results

import (
	"context"
	"testing"
)

type fakeRepository struct {
	result *Result
}

func (r *fakeRepository) Create(_ context.Context, input CreateInput) (*Result, error) {
	r.result = &Result{
		ID:          1,
		TotalRounds: input.TotalRounds,
		Times:       append([]int(nil), input.Times...),
		Missclicks:  input.Missclicks,
		AverageMs:   input.AverageMs,
		SessionID:   input.SessionID,
	}

	return r.result, nil
}

func TestServiceCreateValidatesInput(t *testing.T) {
	service := NewService(&fakeRepository{})

	_, err := service.Create(context.Background(), CreateInput{
		TotalRounds: 3,
		Times:       []int{220, 210},
		Missclicks:  0,
		AverageMs:   215,
	})
	if err == nil {
		t.Fatal("expected validation error for mismatched rounds")
	}
}

func TestServiceCreateNormalizesSessionID(t *testing.T) {
	repository := &fakeRepository{}
	service := NewService(repository)
	sessionID := "  session-1  "

	result, err := service.Create(context.Background(), CreateInput{
		TotalRounds: 3,
		Times:       []int{220, 210, 230},
		Missclicks:  1,
		AverageMs:   220,
		SessionID:   &sessionID,
	})
	if err != nil {
		t.Fatalf("expected result create to succeed, got error: %v", err)
	}

	if result.ID != 1 {
		t.Fatalf("expected result id 1, got %d", result.ID)
	}
	if repository.result == nil || repository.result.SessionID == nil {
		t.Fatal("expected repository to receive normalized session id")
	}
	if *repository.result.SessionID != "session-1" {
		t.Fatalf("expected normalized session id, got %q", *repository.result.SessionID)
	}
}
