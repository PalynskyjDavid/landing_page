package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/palyndav/my-backend/internal/platform/identifier"
)

func TestAnonymousPlayerCreatesSecureCookieAndContextValue(t *testing.T) {
	var contextPlayerID string
	handler := AnonymousPlayer(true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextPlayerID, _ = PlayerIDFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health", nil))

	if _, valid := identifier.NormalizeUUID(contextPlayerID); !valid {
		t.Fatalf("expected UUID player ID in context, got %q", contextPlayerID)
	}

	cookies := response.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one cookie, got %d", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != AnonymousPlayerCookieName || cookie.Value != contextPlayerID {
		t.Fatalf("unexpected player cookie: %#v", cookie)
	}
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected HttpOnly, Secure, SameSite=Lax cookie, got %#v", cookie)
	}
	if cookie.Path != "/" || cookie.MaxAge != anonymousPlayerCookieMaxAge {
		t.Fatalf("unexpected cookie lifetime or path: %#v", cookie)
	}
}

func TestAnonymousPlayerReusesValidCookie(t *testing.T) {
	const playerID = "550e8400-e29b-41d4-a716-446655440000"
	var contextPlayerID string
	handler := AnonymousPlayer(false)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextPlayerID, _ = PlayerIDFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.AddCookie(&http.Cookie{Name: AnonymousPlayerCookieName, Value: playerID})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if contextPlayerID != playerID {
		t.Fatalf("expected player ID %q, got %q", playerID, contextPlayerID)
	}
	if len(response.Result().Cookies()) != 0 {
		t.Fatal("expected valid cookie not to be replaced")
	}
}
