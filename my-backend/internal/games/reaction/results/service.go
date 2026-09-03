package results

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/palyndav/my-backend/internal/apperror"
)

const requiredRoundCount = 5
const maxDisplayNameLength = 24

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Result, error) {
	input.SessionID = normalizeOptionalString(input.SessionID)
	input.DisplayName = normalizeOptionalString(input.DisplayName)

	if err := validateCreateInput(input); err != nil {
		return nil, err
	}

	params := CreateParams{
		TotalRounds: requiredRoundCount,
		Times:       append([]int(nil), input.Times...),
		Missclicks:  input.Missclicks,
		AverageMs:   calculateAverageMs(input.Times),
		SessionID:   input.SessionID,
		DisplayName: input.DisplayName,
	}

	result, err := s.repository.Create(ctx, params)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func validateCreateInput(input CreateInput) error {
	if len(input.Times) != requiredRoundCount {
		return apperror.BadRequest("score_invalid_round_count", "times must contain exactly five reaction times.", nil)
	}
	for _, timeMs := range input.Times {
		if timeMs <= 0 {
			return apperror.BadRequest("score_invalid_time", "times must contain only positive values.", nil)
		}
	}
	if input.Missclicks < 0 {
		return apperror.BadRequest("score_invalid_missclicks", "missclicks cannot be negative.", nil)
	}
	if input.DisplayName != nil && utf8.RuneCountInString(*input.DisplayName) > maxDisplayNameLength {
		return apperror.BadRequest("score_display_name_too_long", "displayName cannot be longer than 24 characters.", nil)
	}

	return nil
}

func calculateAverageMs(times []int) int {
	total := 0
	for _, timeMs := range times {
		total += timeMs
	}

	return total / len(times)
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}
