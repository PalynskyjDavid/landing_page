package reliabilitylab

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	httpapi "github.com/palyndav/my-backend/internal/platform/transport/http"
)

const Address = "127.0.0.1:5196"
const Origin = "http://" + Address
const labCookie = "lab_reaction_player_id"

// Cookies are NOT isolated by port. Translate just the lab's cookie; never
// forward or overwrite the development/E2E anonymous-player cookie.
func isolateRequestCookie(r *http.Request) {
	cookie, err := r.Cookie(labCookie)
	r.Header.Del("Cookie")
	if err == nil {
		r.AddCookie(&http.Cookie{Name: httpapi.AnonymousPlayerCookieName, Value: cookie.Value})
	}
}

func isolateResponseCookie(r *http.Response) error {
	cookies := r.Cookies()
	r.Header.Del("Set-Cookie")
	for _, cookie := range cookies {
		if cookie.Name == httpapi.AnonymousPlayerCookieName {
			cookie.Name, cookie.Path, cookie.Domain = labCookie, "/api", ""
			r.Header.Add("Set-Cookie", cookie.String())
		}
	}
	return nil
}

func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// NewHandler serves a separate origin so demo cookies, outbox and scores cannot
// mix with development/production. No production NGINX or API routes are modified.
func NewHandler(manager *Manager, health *HealthMonitor, assets string) (http.Handler, error) {
	index, err := os.ReadFile(filepath.Join(assets, "index.html"))
	if err != nil {
		return nil, err
	}
	if !strings.Contains(string(index), "</head>") {
		return nil, errors.New("missing built frontend head")
	}
	index = []byte(strings.Replace(string(index), "</head>",
		`<meta name="reliability-lab" content="isolated"></head>`, 1))
	target, err := url.Parse("http://127.0.0.1:3117")
	if err != nil {
		return nil, err
	}
	proxy := &httputil.ReverseProxy{}
	proxy.Rewrite = func(p *httputil.ProxyRequest) {
		r := p.Out
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/api")
		r.URL.RawPath = ""
		isolateRequestCookie(r)
		r.Header.Del("Forwarded")
		r.Header.Del("X-Forwarded-For")
		r.Header.Del("X-Forwarded-Host")
		r.Header.Del("X-Forwarded-Proto")
		p.SetURL(target)
	}
	proxy.ModifyResponse = isolateResponseCookie
	proxy.Transport = &http.Transport{ResponseHeaderTimeout: 5 * time.Second, MaxIdleConnsPerHost: 10}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"code": "service_unavailable", "message": "Demo API unavailable"})
	}
	mux := http.NewServeMux()
	mux.Handle("/api/", proxy)
	mux.HandleFunc("GET /lab-api/status", func(w http.ResponseWriter, _ *http.Request) {
		jsonResponse(w, http.StatusOK, manager.Snapshot())
	})
	mux.HandleFunc("GET /lab-api/health", func(w http.ResponseWriter, _ *http.Request) {
		jsonResponse(w, http.StatusOK, health.Snapshot())
	})
	mux.HandleFunc("POST /lab-api/commands", func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			jsonResponse(w, 415, map[string]string{"code": "json_required"})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 512)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var command struct {
			Action  string  `json:"action"`
			Service Service `json:"service"`
			Mode    string  `json:"mode"`
		}
		if decoder.Decode(&command) != nil || decoder.Decode(&struct{}{}) != io.EOF ||
			!validService(command.Service) ||
			(command.Action != "stop" && command.Action != "start") ||
			(command.Action == "start" && command.Mode != "") {
			jsonResponse(w, 400, map[string]string{"code": "invalid_command"})
			return
		}
		// Disconnecting/navigating away must not cancel a submitted Docker action
		// or its recovery. The durable deadline is managed outside this request.
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if command.Action == "stop" {
			err = manager.Stop(ctx, command.Service, command.Mode)
		} else {
			err = manager.Start(ctx, command.Service)
		}
		if err != nil {
			var rejected *Rejection
			if errors.As(err, &rejected) {
				if rejected.RetryAfter > 0 {
					w.Header().Set("Retry-After", strconv.Itoa(rejected.RetryAfter))
				}
				jsonResponse(w, rejected.Status, map[string]string{"code": rejected.Code})
			} else {
				jsonResponse(w, 503, map[string]string{"code": "operation_failed"})
			}
			return
		}
		jsonResponse(w, 200, manager.Snapshot())
	})
	files := http.FileServer(http.Dir(assets))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		switch r.URL.Path {
		case "/", "/game", "/statistics", "/cv", "/projects/flowento", "/projects/hand-controller", "/dev/analytics":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = w.Write(index)
		default:
			clean := path.Clean("/" + r.URL.Path)
			file, err := os.Stat(filepath.Join(assets, filepath.FromSlash(clean[1:])))
			if err != nil || file.IsDir() || strings.HasPrefix(clean, "/lab-api") {
				http.NotFound(w, r)
				return
			}
			files.ServeHTTP(w, r)
		}
	})
	// A modest global concurrency cap bounds queued HTTP work. Recovery does not
	// use this semaphore, so request floods cannot consume its execution slot.
	slots := make(chan struct{}, 16)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(self), microphone=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
		if r.Host != Address || (r.Header.Get("Origin") != "" && r.Header.Get("Origin") != Origin) {
			jsonResponse(w, 403, map[string]string{"code": "local_origin_required"})
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Header.Get("Origin") != Origin {
			jsonResponse(w, 403, map[string]string{"code": "local_origin_required"})
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			w.Header().Set("Retry-After", "1")
			jsonResponse(w, 429, map[string]string{"code": "controller_busy"})
			return
		}
		mux.ServeHTTP(w, r)
	}), nil
}
