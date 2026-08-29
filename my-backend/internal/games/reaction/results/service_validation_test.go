package results

import (
	"context"
	"testing"

	"github.com/palyndav/my-backend/internal/apperror"
)

func validCreateInput() CreateInput {
	return CreateInput{
		TotalRounds: 3,
		Times:       []int{220, 210, 230},
		Missclicks:  0,
		AverageMs:   220,
	}
}

func requireErrorCode(t *testing.T, err error, wantCode string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected error code %q, got nil", wantCode)
	}

	appErr := apperror.From(err)
	if appErr.Code != wantCode {
		t.Fatalf("expected error code %q, got %q", wantCode, appErr.Code)
	}
}

func TestServiceCreateRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name     string
		change   func(*CreateInput)
		wantCode string
	}{
		{
			name: "zero total rounds",
			change: func(input *CreateInput) {
				input.TotalRounds = 0
			},
			wantCode: "score_invalid_total_rounds",
		},
		{
			name: "missing times",
			change: func(input *CreateInput) {
				input.Times = nil
			},
			wantCode: "score_missing_times",
		},
		{
			name: "times do not match rounds",
			change: func(input *CreateInput) {
				input.Times = []int{220, 210}
			},
			wantCode: "score_times_mismatch",
		},
		{
			name: "non-positive reaction time",
			change: func(input *CreateInput) {
				input.Times[1] = 0
			},
			wantCode: "score_invalid_time",
		},
		{
			name: "negative missclicks",
			change: func(input *CreateInput) {
				input.Missclicks = -1
			},
			wantCode: "score_invalid_missclicks",
		},
		{
			name: "non-positive average",
			change: func(input *CreateInput) {
				input.AverageMs = 0
			},
			wantCode: "score_invalid_average_ms",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := &fakeRepository{}
			service := NewService(repo)
			input := validCreateInput()
			test.change(&input)

			_, err := service.Create(context.Background(), input)

			requireErrorCode(t, err, test.wantCode)
			if repo.createCalls != 0 {
				t.Fatalf("expected repository not to be called, got %d calls", repo.createCalls)
			}
		})
	}
}
