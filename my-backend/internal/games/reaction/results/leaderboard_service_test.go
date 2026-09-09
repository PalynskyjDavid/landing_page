package results

import (
	"context"
	"errors"
	"testing"
)

func TestServiceLeaderboardUsesDefaults(t *testing.T) {
	repo := &fakeRepository{entries: []LeaderboardEntry{{ScoreID: 42}}}
	service := NewService(repo)

	entries, err := service.Leaderboard(context.Background(), LeaderboardOptions{})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	wantParams := LeaderboardParams{
		Limit:         defaultLeaderboardLimit,
		PrimarySort:   LeaderboardSort{Field: leaderboardSortAverageMs, Direction: leaderboardSortBest},
		SecondarySort: LeaderboardSort{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
	}
	if repo.gotLeaderboardParams != wantParams {
		t.Fatalf("unexpected repository parameters: want %#v, got %#v", wantParams, repo.gotLeaderboardParams)
	}
	if len(entries) != 1 || entries[0].ScoreID != 42 {
		t.Fatalf("unexpected entries: %#v", entries)
	}
}

func TestServiceLeaderboardPassesRequestedSortOrder(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)
	options := LeaderboardOptions{
		Limit: 5,
		Sort: []LeaderboardSort{
			{Field: leaderboardSortBestMs, Direction: leaderboardSortWorst},
			{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
		},
	}

	_, err := service.Leaderboard(context.Background(), options)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	wantParams := LeaderboardParams{
		Limit:         5,
		PrimarySort:   LeaderboardSort{Field: leaderboardSortBestMs, Direction: leaderboardSortWorst},
		SecondarySort: LeaderboardSort{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
	}
	if repo.gotLeaderboardParams != wantParams {
		t.Fatalf("unexpected repository parameters: want %#v, got %#v", wantParams, repo.gotLeaderboardParams)
	}
}

func TestServiceLeaderboardRejectsInvalidLimit(t *testing.T) {
	tests := []struct {
		name  string
		limit int
	}{
		{name: "negative", limit: -1},
		{name: "above maximum", limit: maxLeaderboardLimit + 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := &fakeRepository{}
			service := NewService(repo)

			entries, err := service.Leaderboard(context.Background(), LeaderboardOptions{Limit: test.limit})

			requireErrorCode(t, err, "score_invalid_limit")
			if entries != nil {
				t.Fatalf("expected nil entries, got %#v", entries)
			}
			if repo.leaderboardCalls != 0 {
				t.Fatalf("expected repository not to be called, got %d calls", repo.leaderboardCalls)
			}
		})
	}
}

func TestServiceLeaderboardRejectsInvalidSort(t *testing.T) {
	tests := []struct {
		name string
		sort []LeaderboardSort
	}{
		{name: "unknown field", sort: []LeaderboardSort{{Field: "fastest", Direction: leaderboardSortBest}}},
		{name: "unknown direction", sort: []LeaderboardSort{{Field: leaderboardSortBestMs, Direction: "sideways"}}},
		{name: "duplicate fields", sort: []LeaderboardSort{
			{Field: leaderboardSortBestMs, Direction: leaderboardSortBest},
			{Field: leaderboardSortBestMs, Direction: leaderboardSortWorst},
		}},
		{name: "more than two fields", sort: []LeaderboardSort{
			{Field: leaderboardSortBestMs, Direction: leaderboardSortBest},
			{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
			{Field: leaderboardSortAverageMs, Direction: leaderboardSortBest},
		}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := &fakeRepository{}
			service := NewService(repo)

			entries, err := service.Leaderboard(context.Background(), LeaderboardOptions{Sort: test.sort})

			requireErrorCode(t, err, "score_invalid_sort")
			if entries != nil {
				t.Fatalf("expected nil entries, got %#v", entries)
			}
			if repo.leaderboardCalls != 0 {
				t.Fatalf("expected repository not to be called, got %d calls", repo.leaderboardCalls)
			}
		})
	}
}

func TestServiceLeaderboardReturnsRepositoryError(t *testing.T) {
	repositoryError := errors.New("database unavailable")
	repo := &fakeRepository{leaderboardErr: repositoryError}
	service := NewService(repo)

	entries, err := service.Leaderboard(context.Background(), LeaderboardOptions{Limit: 5})

	if entries != nil {
		t.Fatalf("expected nil entries, got %#v", entries)
	}
	if !errors.Is(err, repositoryError) {
		t.Fatalf("expected repository error %v, got %v", repositoryError, err)
	}
	if repo.gotLeaderboardParams.Limit != 5 {
		t.Fatalf("expected limit 5, got %d", repo.gotLeaderboardParams.Limit)
	}
}
