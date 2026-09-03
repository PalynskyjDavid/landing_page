package results

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/palyndav/my-backend/internal/apperror"
)

const requiredRoundCount = 5
const maxDisplayNameLength = 24
const defaultLeaderboardLimit = 10
const maxLeaderboardLimit = 50

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

func (s *Service) Leaderboard(ctx context.Context, options LeaderboardOptions) ([]LeaderboardEntry, error) {
	if options.Limit == 0 {
		options.Limit = defaultLeaderboardLimit
	}
	if options.Limit < 1 || options.Limit > maxLeaderboardLimit {
		return nil, apperror.BadRequest("score_invalid_limit", "limit must be between 1 and 50.", nil)
	}

	sort, err := normalizeLeaderboardSort(options.Sort)
	if err != nil {
		return nil, err
	}

	return s.repository.ListLeaderboard(ctx, LeaderboardParams{
		Limit:         options.Limit,
		PrimarySort:   sort[0],
		SecondarySort: sort[1],
	})
}

func normalizeLeaderboardSort(sort []LeaderboardSort) ([2]LeaderboardSort, error) {
	if len(sort) == 0 {
		return [2]LeaderboardSort{
			{Field: leaderboardSortAverageMs, Direction: leaderboardSortBest},
			{Field: leaderboardSortMissclicks, Direction: leaderboardSortBest},
		}, nil
	}
	if len(sort) > 2 {
		return [2]LeaderboardSort{}, invalidLeaderboardSortError()
	}

	for _, selection := range sort {
		if !isSupportedLeaderboardSortField(selection.Field) || !isSupportedLeaderboardSortDirection(selection.Direction) {
			return [2]LeaderboardSort{}, invalidLeaderboardSortError()
		}
	}

	if len(sort) == 2 {
		if sort[0].Field == sort[1].Field {
			return [2]LeaderboardSort{}, invalidLeaderboardSortError()
		}
		return [2]LeaderboardSort{sort[0], sort[1]}, nil
	}

	secondaryField := leaderboardSortMissclicks
	if sort[0].Field == secondaryField {
		secondaryField = leaderboardSortAverageMs
	}

	return [2]LeaderboardSort{
		sort[0],
		{Field: secondaryField, Direction: leaderboardSortBest},
	}, nil
}

func isSupportedLeaderboardSortField(field LeaderboardSortField) bool {
	return field == leaderboardSortAverageMs || field == leaderboardSortBestMs || field == leaderboardSortMissclicks
}

func isSupportedLeaderboardSortDirection(direction LeaderboardSortDirection) bool {
	return direction == leaderboardSortBest || direction == leaderboardSortWorst
}

func invalidLeaderboardSortError() error {
	return apperror.BadRequest(
		"score_invalid_sort",
		"sort must contain one or two different field:direction pairs using averageMs, bestMs, or missclicks and best or worst.",
		nil,
	)
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
