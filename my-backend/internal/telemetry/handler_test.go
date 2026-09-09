package telemetry

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeReader struct {
	calls int
	err   error
}

func (r *fakeReader) Read(context.Context, Options) (*Report, error) {
	r.calls++
	return &Report{Source: "nginx", GeneratedAt: time.Now(), Points: []Point{}}, r.err
}
func TestHandlerRejectsInvalidFiltersAndHidesStorageErrors(t *testing.T) {
	for _, target := range []string{"/system/statistics?period=forever", "/system/statistics?route=/admin"} {
		reader := &fakeReader{}
		response := httptest.NewRecorder()
		Handler{reader}.ServeHTTP(response, httptest.NewRequest("GET", target, nil))
		if response.Code != 400 || reader.calls != 0 {
			t.Fatal("invalid filter reached DB")
		}
	}
	reader := &fakeReader{err: errors.New("secret database URL")}
	response := httptest.NewRecorder()
	Handler{reader}.ServeHTTP(response, httptest.NewRequest("GET", "/system/statistics", nil))
	if response.Code != 503 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("wrong unavailable response")
	}
	if response.Body.String() != "{\"error\":{\"code\":\"telemetry_unavailable\",\"message\":\"System statistics are temporarily unavailable.\"}}\n" {
		t.Fatal("unexpected or unsafe error")
	}
}
