package httpapi

import (
	"context"
	"net/http"

	"github.com/palyndav/my-backend/internal/apperror"
	"github.com/palyndav/my-backend/internal/platform/identifier"
)

const AnonymousPlayerCookieName = "reaction_player_id"
const anonymousPlayerCookieMaxAge = 60 * 60 * 24 * 365

type playerIDContextKey struct{}

type playerIdentity struct {
	id          string
	established bool
}

func AnonymousPlayer(cookieSecure bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			playerID, shouldSetCookie, err := resolvePlayerID(r)
			if err != nil {
				WriteError(w, nil, apperror.Internal("player_id_generation_failed", "Failed to identify player.", err))
				return
			}

			if shouldSetCookie {
				http.SetCookie(w, &http.Cookie{
					Name:     AnonymousPlayerCookieName,
					Value:    playerID,
					Path:     "/",
					MaxAge:   anonymousPlayerCookieMaxAge,
					HttpOnly: true,
					Secure:   cookieSecure,
					SameSite: http.SameSiteLaxMode,
				})
			}

			ctx := context.WithValue(r.Context(), playerIDContextKey{}, playerIdentity{
				id: playerID, established: !shouldSetCookie,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func PlayerIDFromContext(ctx context.Context) (string, bool) {
	identity, ok := ctx.Value(playerIDContextKey{}).(playerIdentity)
	return identity.id, ok && identity.id != ""
}

// A cookie sent back by the caller is established. Merely issuing Set-Cookie
// does not prove the browser received it; the response could be lost.
func PlayerCookieEstablished(ctx context.Context) bool {
	identity, ok := ctx.Value(playerIDContextKey{}).(playerIdentity)
	return ok && identity.established
}

func resolvePlayerID(r *http.Request) (string, bool, error) {
	if cookie, err := r.Cookie(AnonymousPlayerCookieName); err == nil {
		if playerID, valid := identifier.NormalizeUUID(cookie.Value); valid {
			return playerID, false, nil
		}
	}

	playerID, err := identifier.NewUUID()
	if err != nil {
		return "", false, err
	}

	return playerID, true, nil
}
