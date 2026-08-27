package stats

import "context"

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) GetSummary(ctx context.Context) (*Summary, error) {
	return s.repository.GetSummary(ctx)
}

func (s *Service) RefreshSummary(ctx context.Context) (bool, *Summary, error) {
	return s.repository.RefreshSummary(ctx)
}
