package results

import (
	"context"
	"strings"

	"backend-go/internal/apperror"
)

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Result, error) {
	if err := validateCreateInput(input); err != nil {
		return nil, err
	}

	input.SessionID = normalizeOptionalString(input.SessionID)

	result, err := s.repository.Create(ctx, input)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func validateCreateInput(input CreateInput) error {
	if input.TotalRounds <= 0 {
		return apperror.BadRequest("score_invalid_total_rounds", "totalRounds must be greater than zero.", nil)
	}
	if len(input.Times) == 0 {
		return apperror.BadRequest("score_missing_times", "times must contain at least one score.", nil)
	}
	if len(input.Times) != input.TotalRounds {
		return apperror.BadRequest("score_times_mismatch", "times length must match totalRounds.", nil)
	}
	for _, timeMs := range input.Times {
		if timeMs <= 0 {
			return apperror.BadRequest("score_invalid_time", "times must contain only positive values.", nil)
		}
	}
	if input.Missclicks < 0 {
		return apperror.BadRequest("score_invalid_missclicks", "missclicks cannot be negative.", nil)
	}
	if input.AverageMs <= 0 {
		return apperror.BadRequest("score_invalid_average_ms", "averageMs must be greater than zero.", nil)
	}

	return nil
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
