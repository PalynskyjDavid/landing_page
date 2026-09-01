package results

import (
	"context"
	"errors"
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

// Each call creates fresh input so tests can change it independently.
func validCreateInput() CreateInput {
	return CreateInput{
		TotalRounds: 3,
		Times:       []int{220, 210, 230},
		Missclicks:  0,
		AverageMs:   220,
	}
}

func TestServiceCreateReturnsRepositoryError(t *testing.T) {
	// Arrange: valid input should reach a repository configured to fail.
	repositoryError := errors.New("database unavailable")
	repo := &fakeRepository{err: repositoryError}
	service := NewService(repo)
	input := validCreateInput()

	// Act: call the real service, not the fake repository directly.
	result, err := service.Create(context.Background(), input)

	// Assert: the service returns no result and preserves the repository error.
	if result != nil {
		t.Fatalf("expected nil result, got %#v", result)
	}
	if !errors.Is(err, repositoryError) {
		t.Fatalf("expected repository error %v, got %v", repositoryError, err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("expected repository to be called once, got %d calls", repo.createCalls)
	}
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
