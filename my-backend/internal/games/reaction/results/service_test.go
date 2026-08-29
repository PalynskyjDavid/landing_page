package results

// Behave as signle test file
// go test ./internal/games/reaction/results
// go test -v ./internal/games/reaction/results
// Behaves as whole package test so imports work properly
// go test ./internal/games/reaction/results -run TestService

import (
	"context"
	"testing"
)

type fakeRepository struct {
	createCalls int
	gotInput    CreateInput
	result      *Result
	err         error
}

func (r *fakeRepository) Create(_ context.Context, input CreateInput) (*Result, error) {
	r.createCalls++
	r.gotInput = input

	if r.err != nil {
		return nil, r.err
	}

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

func TestServiceCreateNormalizesSessionID(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	sessionID := "  session-1  "

	result, err := service.Create(context.Background(), CreateInput{
		TotalRounds: 3,
		Times:       []int{220, 210, 230},
		Missclicks:  1,
		AverageMs:   220,
		SessionID:   &sessionID,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result == nil {
		t.Fatal("expected result, got nil")
	}

	if repo.gotInput.SessionID == nil {
		t.Fatal("expected normalized session id to be passed to repository")
	}

	if *repo.gotInput.SessionID != "session-1" {
		t.Fatalf("expected trimmed session id, got %q", *repo.gotInput.SessionID)
	}
}
