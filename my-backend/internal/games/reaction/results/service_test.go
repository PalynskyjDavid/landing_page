package results

import (
	"context"
	"errors"
	"testing"
	"time"
)

const testSubmissionID = "550e8400-e29b-41d4-a716-446655440000"
const testPlayerID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427"

type fakeRepository struct {
	createCalls          int
	gotParams            CreateParams
	createdAt            time.Time
	err                  error
	existingResult       *Result
	leaderboardCalls     int
	gotLeaderboardParams LeaderboardParams
	entries              []LeaderboardEntry
	leaderboardErr       error
	statisticsParams     StatisticsParams
	statisticsCalls      int
	statisticsResult     *Statistics
}

func (r *fakeRepository) ReadStatistics(_ context.Context, params StatisticsParams) (*Statistics, error) {
	r.statisticsCalls++
	r.statisticsParams = params
	if r.leaderboardErr != nil {
		return nil, r.leaderboardErr
	}
	if r.statisticsResult != nil {
		return r.statisticsResult, nil
	}
	return &Statistics{Entries: []StatisticsEntry{}}, nil
}

func (r *fakeRepository) ListLeaderboard(_ context.Context, params LeaderboardParams) ([]LeaderboardEntry, error) {
	r.leaderboardCalls++
	r.gotLeaderboardParams = params

	if r.leaderboardErr != nil {
		return nil, r.leaderboardErr
	}

	// The real adapter returns [] rather than null for an empty leaderboard.
	return append([]LeaderboardEntry{}, r.entries...), nil
}

func (r *fakeRepository) Create(_ context.Context, params CreateParams) (*Result, bool, error) {
	r.createCalls++
	r.gotParams = params

	if r.err != nil {
		return nil, false, r.err
	}
	if r.existingResult != nil {
		return r.existingResult, false, nil
	}

	return &Result{
		ID:           1,
		SubmissionID: params.SubmissionID,
		PlayerID:     params.PlayerID,
		TotalRounds:  params.TotalRounds,
		Times:        append([]int(nil), params.Times...),
		Missclicks:   params.Missclicks,
		AverageMs:    params.AverageMs,
		DisplayName:  params.DisplayName,
		CreatedAt:    r.createdAt,
	}, true, nil
}

// Each call creates fresh input so tests can change it independently.
func validCreateInput() CreateInput {
	return CreateInput{
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   0,
	}
}

func TestServiceCreateReturnsRepositoryError(t *testing.T) {
	// Arrange: valid input should reach a repository configured to fail.
	repositoryError := errors.New("database unavailable")
	repo := &fakeRepository{err: repositoryError}
	service := NewService(repo)
	input := validCreateInput()

	// Act: call the real service, not the fake repository directly.
	result, _, err := service.Create(context.Background(), input)

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

func TestServiceCreateNormalizesIdentifiersAndDisplayNameAndDerivesValues(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	displayName := "  David  "

	result, created, err := service.Create(context.Background(), CreateInput{
		SubmissionID: "550E8400-E29B-41D4-A716-446655440000",
		PlayerID:     "1B4E28BA-2FA1-11D2-883F-0016D3CCA427",
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		DisplayName:  &displayName,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if result == nil {
		t.Fatal("expected result, got nil")
	}
	if !created {
		t.Fatal("expected newly created result")
	}
	if repo.gotParams.SubmissionID != testSubmissionID {
		t.Fatalf("expected normalized submission ID, got %q", repo.gotParams.SubmissionID)
	}
	if repo.gotParams.PlayerID != testPlayerID {
		t.Fatalf("expected normalized player ID, got %q", repo.gotParams.PlayerID)
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

	_, _, err := service.Create(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.gotParams.DisplayName != nil {
		t.Fatalf("expected nil display name, got %q", *repo.gotParams.DisplayName)
	}
}

func TestServiceCreateReturnsExistingIdenticalSubmission(t *testing.T) {
	displayName := "David"
	existing := &Result{
		ID:           42,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		AverageMs:    241,
		DisplayName:  &displayName,
	}
	repo := &fakeRepository{existingResult: existing}
	service := NewService(repo)

	result, created, err := service.Create(context.Background(), CreateInput{
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		Times:        []int{241, 228, 255, 249, 235},
		Missclicks:   1,
		DisplayName:  &displayName,
	})
	if err != nil {
		t.Fatalf("expected identical retry to succeed, got %v", err)
	}
	if created {
		t.Fatal("expected retry to return existing result")
	}
	if result != existing {
		t.Fatalf("expected existing result, got %#v", result)
	}
}

func TestServiceCreateRejectsConflictingSubmission(t *testing.T) {
	existing := &Result{
		ID:           42,
		SubmissionID: testSubmissionID,
		PlayerID:     testPlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        []int{241, 228, 255, 249, 235},
		AverageMs:    241,
	}
	repo := &fakeRepository{existingResult: existing}
	service := NewService(repo)
	input := validCreateInput()
	input.Times[0] = 300

	result, created, err := service.Create(context.Background(), input)

	if result != nil || created {
		t.Fatalf("expected no result for conflicting retry, got %#v, created %t", result, created)
	}
	requireErrorCode(t, err, "score_submission_conflict")
}

func TestCalculateAverageMsRoundsDown(t *testing.T) {
	got := calculateAverageMs([]int{100, 101, 102, 103, 105})

	if got != 102 {
		t.Fatalf("expected average to round down to 102, got %d", got)
	}
}
