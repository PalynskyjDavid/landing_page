package results

import (
	"net/http/httptest"
	"testing"
)

func TestCreateDeviceTypeValidationAndDefault(t *testing.T) {
	for _, value := range []string{"", "computer", "mobile", "tablet", "COMPUTER", "mixed", " mobile "} {
		t.Run(value, func(t *testing.T) {
			repo := &fakeRepository{}
			input := validCreateInput()
			input.DeviceType = value
			result, _, err := NewService(repo).Create(t.Context(), input)
			if value != "" && !validDeviceType(value) {
				requireErrorCode(t, err, "score_invalid_device_type")
				if repo.createCalls != 0 {
					t.Fatal("invalid device reached repository")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if result.DeviceType != defaultDeviceType(value) || repo.gotParams.DeviceType != defaultDeviceType(value) {
				t.Fatalf("device not persisted: result=%#v params=%#v", result, repo.gotParams)
			}
		})
	}
}

func TestDeviceTypeIsPartOfSubmissionIdentity(t *testing.T) {
	for _, initial := range []string{"", "computer", "mobile"} {
		t.Run(initial, func(t *testing.T) {
			repo := &fakeRepository{}
			service := NewService(repo)
			input := validCreateInput()
			input.DeviceType = initial
			result, _, err := service.Create(t.Context(), input)
			if err != nil {
				t.Fatal(err)
			}
			repo.existingResult = result
			input.DeviceType = defaultDeviceType(initial)
			replay, created, err := service.Create(t.Context(), input)
			if err != nil || created || replay.ID != result.ID {
				t.Fatalf("replay failed: %v", err)
			}
			if input.DeviceType == deviceMobile {
				input.DeviceType = deviceComputer
			} else {
				input.DeviceType = deviceMobile
			}
			_, _, err = service.Create(t.Context(), input)
			requireErrorCode(t, err, "score_submission_conflict")
		})
	}
}

func TestStatisticsDeviceFilterParsingAndValidation(t *testing.T) {
	for _, value := range []string{"", "computer", "mobile", "mixed", "phone", "COMPUTER"} {
		t.Run(value, func(t *testing.T) {
			options, err := parseStatisticsOptions(httptest.NewRequest("GET", "/scores/statistics?deviceType="+value, nil))
			if err != nil {
				t.Fatal(err)
			}
			repo := &fakeRepository{}
			_, err = NewService(repo).Statistics(t.Context(), options)
			if value != "" && !validDeviceType(value) {
				requireErrorCode(t, err, "score_invalid_filter")
				if repo.statisticsCalls != 0 {
					t.Fatal("invalid device reached repository")
				}
			} else if err != nil || repo.statisticsParams.DeviceType != value {
				t.Fatalf("filter not forwarded: %#v, %v", repo.statisticsParams, err)
			}
		})
	}
}
