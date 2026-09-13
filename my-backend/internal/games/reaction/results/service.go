package results

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/palyndav/my-backend/internal/apperror"
	"github.com/palyndav/my-backend/internal/platform/identifier"
)

const requiredRoundCount = 5
const maxDisplayNameLength = 24
const defaultLeaderboardLimit = 10
const maxLeaderboardLimit = 50

type Service struct {
	repository Repository
	now        func() time.Time
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Result, bool, error) {
	var valid bool
	input.SubmissionID, valid = identifier.NormalizeUUID(input.SubmissionID)
	if !valid {
		return nil, false, apperror.BadRequest("score_invalid_submission_id", "submissionId must be a valid UUID.", nil)
	}

	input.PlayerID, valid = identifier.NormalizeUUID(input.PlayerID)
	if !valid {
		return nil, false, apperror.BadRequest("score_invalid_player_id", "playerId must be a valid UUID.", nil)
	}

	input.DeviceType = defaultDeviceType(input.DeviceType)
	input.DisplayName = normalizeOptionalString(input.DisplayName)

	if err := validateCreateInput(input); err != nil {
		return nil, false, err
	}

	params := CreateParams{
		SubmissionID: input.SubmissionID,
		PlayerID:     input.PlayerID,
		TotalRounds:  requiredRoundCount,
		Times:        append([]int(nil), input.Times...),
		Missclicks:   input.Missclicks,
		AverageMs:    calculateAverageMs(input.Times),
		DisplayName:  input.DisplayName,
		DeviceType:   input.DeviceType,
	}

	result, created, err := s.repository.Create(ctx, params)
	if err != nil {
		return nil, false, err
	}
	if !created && !sameSubmission(result, params) {
		return nil, false, apperror.Conflict(
			"score_submission_conflict",
			"submissionId was already used for different score data.",
			nil,
		)
	}

	return result, created, nil
}

func sameSubmission(result *Result, params CreateParams) bool {
	if result == nil ||
		result.SubmissionID != params.SubmissionID ||
		result.PlayerID != params.PlayerID ||
		defaultDeviceType(result.DeviceType) != defaultDeviceType(params.DeviceType) ||
		result.TotalRounds != params.TotalRounds ||
		result.Missclicks != params.Missclicks ||
		result.AverageMs != params.AverageMs ||
		!sameOptionalString(result.DisplayName, params.DisplayName) ||
		len(result.Times) != len(params.Times) {
		return false
	}

	for index := range result.Times {
		if result.Times[index] != params.Times[index] {
			return false
		}
	}

	return true
}

func sameOptionalString(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}

	return *left == *right
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
	if !validDeviceType(defaultDeviceType(input.DeviceType)) {
		return apperror.BadRequest("score_invalid_device_type", "deviceType must be computer or mobile.", nil)
	}
	if len(input.Times) != requiredRoundCount {
		return apperror.BadRequest("score_invalid_round_count", "times must contain exactly five reaction times.", nil)
	}
	for _, timeMs := range input.Times {
		if timeMs <= 0 || timeMs > 2147483647 {
			return apperror.BadRequest("score_invalid_time", "times must contain integers between 1 and 2147483647.", nil)
		}
	}
	if input.Missclicks < 0 || input.Missclicks > 2147483647 {
		return apperror.BadRequest("score_invalid_missclicks", "missclicks must be between 0 and 2147483647.", nil)
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
