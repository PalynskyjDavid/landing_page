package results

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeRepository struct {
	createCalls          int
	gotParams            CreateParams
	createdAt            time.Time
	err                  error
	leaderboardCalls     int
	gotLeaderboardParams LeaderboardParams
	entries              []LeaderboardEntry
	leaderboardErr       error
}

func (r *fakeRepository) ListLeaderboard(_ context.Context, params LeaderboardParams) ([]LeaderboardEntry, error) {
	r.leaderboardCalls++
	r.gotLeaderboardParams = params

	if r.leaderboardErr != nil {
		return nil, r.leaderboardErr
	}

	return append([]LeaderboardEntry(nil), r.entries...), nil
}

func (r *fakeRepository) Create(_ context.Context, params CreateParams) (*Result, error) {
	r.createCalls++
	r.gotParams = params

	if r.err != nil {
		return nil, r.err
	}

	return &Result{
		ID:          1,
		TotalRounds: params.TotalRounds,
		Times:       append([]int(nil), params.Times...),
		Missclicks:  params.Missclicks,
		AverageMs:   params.AverageMs,
		SessionID:   params.SessionID,
		DisplayName: params.DisplayName,
		CreatedAt:   r.createdAt,
	}, nil
}

// Each call creates fresh input so tests can change it independently.
func validCreateInput() CreateInput {
	return CreateInput{
		Times:      []int{241, 228, 255, 249, 235},
		Missclicks: 0,
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

func TestServiceCreateNormalizesOptionalStringsAndDerivesValues(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	sessionID := "  session-1  "
	displayName := "  David  "

	result, err := service.Create(context.Background(), CreateInput{
		Times:       []int{241, 228, 255, 249, 235},
		Missclicks:  1,
		SessionID:   &sessionID,
		DisplayName: &displayName,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result == nil {
		t.Fatal("expected result, got nil")
	}

	if repo.gotParams.SessionID == nil {
		t.Fatal("expected normalized session id to be passed to repository")
	}

	if *repo.gotParams.SessionID != "session-1" {
		t.Fatalf("expected trimmed session id, got %q", *repo.gotParams.SessionID)
	}
	if repo.gotParams.DisplayName == nil {
		t.Fatal("expected normalized display name to be passed to repository")
	}
	if *repo.gotParams.DisplayName != "David" {
		t.Fatalf("expected trimmed display name, got %q", *repo.gotParams.DisplayName)
	}
	if repo.gotParams.TotalRounds != requiredRoundCount {
		t.Fatalf("expected %d derived rounds, got %d", requiredRoundCount, repo.gotParams.TotalRounds)
	}
	if repo.gotParams.AverageMs != 241 {
		t.Fatalf("expected derived average 241, got %d", repo.gotParams.AverageMs)
	}
	if result.TotalRounds != requiredRoundCount || result.AverageMs != 241 {
		t.Fatalf("expected result to contain server-derived values, got %#v", result)
	}
}

func TestServiceCreateTreatsBlankDisplayNameAsMissing(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	displayName := "   "
	input := validCreateInput()
	input.DisplayName = &displayName

	_, err := service.Create(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.gotParams.DisplayName != nil {
		t.Fatalf("expected nil display name, got %q", *repo.gotParams.DisplayName)
	}
}

func TestCalculateAverageMsRoundsDown(t *testing.T) {
	got := calculateAverageMs([]int{100, 101, 102, 103, 105})

	if got != 102 {
		t.Fatalf("expected average to round down to 102, got %d", got)
	}
}
