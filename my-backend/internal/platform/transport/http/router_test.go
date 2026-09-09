package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/palyndav/my-backend/internal/config"
)

type peerAddressRegistrar struct{}

func (peerAddressRegistrar) RegisterRoutes(router chi.Router) {
	router.Get("/test-peer", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Test-Peer", r.RemoteAddr)
		w.WriteHeader(http.StatusNoContent)
	})
}

func TestNewRouterKeepsTransportPeerAddress(t *testing.T) {
	const peer = "192.0.2.10:12345"
	for _, header := range []string{"True-Client-IP", "X-Real-IP", "X-Forwarded-For"} {
		t.Run(header, func(t *testing.T) {
			router := NewRouter(config.Config{}, nil, peerAddressRegistrar{})
			request := httptest.NewRequest(http.MethodGet, "/test-peer", nil)
			request.RemoteAddr = peer
			request.Header.Set(header, "203.0.113.7")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
			}
			if got := response.Header().Get("X-Test-Peer"); got != peer {
				t.Fatalf("peer = %q, want %q; caller-controlled %s must not replace the transport peer", got, peer, header)
			}
		})
	}
}
