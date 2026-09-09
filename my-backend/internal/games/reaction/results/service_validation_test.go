package results

import (
	"context"
	"strings"
	"testing"

	"github.com/palyndav/my-backend/internal/apperror"
)

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
			name: "missing submission ID",
			change: func(input *CreateInput) {
				input.SubmissionID = ""
			},
			wantCode: "score_invalid_submission_id",
		},
		{
			name: "invalid player ID",
			change: func(input *CreateInput) {
				input.PlayerID = "not-a-uuid"
			},
			wantCode: "score_invalid_player_id",
		},
		{
			name: "missing times",
			change: func(input *CreateInput) {
				input.Times = nil
			},
			wantCode: "score_invalid_round_count",
		},
		{
			name: "four reaction times",
			change: func(input *CreateInput) {
				input.Times = input.Times[:4]
			},
			wantCode: "score_invalid_round_count",
		},
		{
			name: "six reaction times",
			change: func(input *CreateInput) {
				input.Times = append(input.Times, 260)
			},
			wantCode: "score_invalid_round_count",
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
			name: "reaction time exceeds database integer range",
			change: func(input *CreateInput) {
				input.Times[0] = 2147483648
			},
			wantCode: "score_invalid_time",
		},
		{
			name: "missclicks exceed database integer range",
			change: func(input *CreateInput) {
				input.Missclicks = 2147483648
			},
			wantCode: "score_invalid_missclicks",
		},
		{
			name: "display name longer than 24 characters",
			change: func(input *CreateInput) {
				displayName := strings.Repeat("a", maxDisplayNameLength+1)
				input.DisplayName = &displayName
			},
			wantCode: "score_display_name_too_long",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := &fakeRepository{}
			service := NewService(repo)
			input := validCreateInput()
			test.change(&input)

			result, _, err := service.Create(context.Background(), input)

			requireErrorCode(t, err, test.wantCode)
			if result != nil {
				t.Fatalf("expected nil result, got %#v", result)
			}
			if repo.createCalls != 0 {
				t.Fatalf("expected repository not to be called, got %d calls", repo.createCalls)
			}
		})
	}
}
