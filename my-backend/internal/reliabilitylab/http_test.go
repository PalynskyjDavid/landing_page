package reliabilitylab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testHandler(t *testing.T) (http.Handler, *fakeDriver) {
	t.Helper()
	m, d, _, _ := fixture(t)
	dir := t.TempDir()
	must(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html><head></head><body>Demo</body></html>"), 0600))
	handler, err := NewHandler(m, NewHealthMonitor(), dir)
	must(t, err)
	return handler, d
}
func request(handler http.Handler, method, path, body, origin, host string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, Origin+path, strings.NewReader(body))
	r.Host = host
	r.Header.Set("Origin", origin)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func TestHTTPGuardsAndValidation(t *testing.T) {
	cases := []struct {
		name, body, origin, host string
		status                   int
	}{
		{"cross origin", `{"action":"stop","service":"api","mode":"timed"}`, "https://evil.test", Address, 403},
		{"missing origin", `{"action":"stop","service":"api","mode":"timed"}`, "", Address, 403},
		{"DNS rebinding", `{"action":"stop","service":"api","mode":"timed"}`, Origin, "evil.test", 403},
		{"unknown target", `{"action":"stop","service":"production","mode":"timed"}`, Origin, Address, 400},
		{"custom duration", `{"action":"stop","service":"api","mode":"timed","seconds":999}`, Origin, Address, 400},
		{"invalid mode", `{"action":"stop","service":"api","mode":"forever"}`, Origin, Address, 400},
		{"trailing object", `{"action":"start","service":"api"} {}`, Origin, Address, 400},
		{"start mode", `{"action":"start","service":"api","mode":"manual"}`, Origin, Address, 400},
		{"oversize", strings.Repeat("x", 513), Origin, Address, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h, d := testHandler(t)
			w := request(h, "POST", "/lab-api/commands", c.body, c.origin, c.host)
			if w.Code != c.status || d.stops != 0 || d.starts != 0 {
				t.Fatalf("%d %s", w.Code, w.Body)
			}
		})
	}
}

func TestHTTPStatusDoesNotCallDockerAndUIIsOptIn(t *testing.T) {
	h, d := testHandler(t)
	before := d.inspections
	for range 5 {
		w := request(h, "GET", "/lab-api/status", "", "", Address)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "isolated-reliability-lab") {
			t.Fatal(w)
		}
	}
	if d.inspections != before {
		t.Fatal("status reads query Docker")
	}
	w := request(h, "GET", "/lab-api/health", "", "", Address)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"samples":[]`) || d.inspections != before {
		t.Fatal("health reads must be cached", w)
	}
	for _, origin := range []string{"https://evil.test", "http://localhost:5196"} {
		if request(h, "GET", "/lab-api/health", "", origin, Address).Code != 403 {
			t.Fatal("health history exposed cross-origin")
		}
	}
	w = request(h, "GET", "/game", "", "", Address)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `name="reliability-lab" content="isolated"`) {
		t.Fatal(w)
	}
	if w.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("missing CSP")
	}
	for _, path := range []string{"/lab-api/anything", "/.env", "/compose.prod.yml"} {
		if got := request(h, "GET", path, "", "", Address).Code; got != 404 {
			t.Fatalf("%s: %d", path, got)
		}
	}
}

func TestHTTPCommandsShareStateAndRetryAfter(t *testing.T) {
	h, _ := testHandler(t)
	w := request(h, "POST", "/lab-api/commands", `{"action":"stop","service":"api","mode":"timed"}`, Origin, Address)
	if w.Code != 200 {
		t.Fatal(w)
	}
	w = request(h, "POST", "/lab-api/commands", `{"action":"stop","service":"db","mode":"manual"}`, Origin, Address)
	if w.Code != 409 {
		t.Fatal(w)
	}
	w = request(h, "POST", "/lab-api/commands", `{"action":"start","service":"api"}`, Origin, Address)
	if w.Code != 200 {
		t.Fatal(w)
	}
	w = request(h, "POST", "/lab-api/commands", `{"action":"stop","service":"db","mode":"timed"}`, Origin, Address)
	if w.Code != 429 || w.Header().Get("Retry-After") != "30" {
		t.Fatal(w)
	}
}

func TestCookiesAreNamespacedDespiteSharedLoopbackHost(t *testing.T) {
	r := httptest.NewRequest("GET", Origin+"/api/health/ready", nil)
	r.Header.Set("Cookie", "reaction_player_id=development; lab_reaction_player_id=demo; other=private")
	isolateRequestCookie(r)
	if got := r.Header.Get("Cookie"); got != "reaction_player_id=demo" {
		t.Fatal(got)
	}
	response := &http.Response{Header: http.Header{}}
	response.Header.Add("Set-Cookie", "reaction_player_id=demo; Path=/; HttpOnly; SameSite=Lax")
	response.Header.Add("Set-Cookie", "other=ignored")
	must(t, isolateResponseCookie(response))
	cookies := response.Cookies()
	if len(cookies) != 1 || cookies[0].Name != labCookie || cookies[0].Path != "/api" || !cookies[0].HttpOnly {
		t.Fatal(cookies)
	}
	r.Header.Set("Cookie", "reaction_player_id=development")
	isolateRequestCookie(r)
	if r.Header.Get("Cookie") != "" {
		t.Fatal("leaked unrelated cookie")
	}
}

func TestDockerOwnershipRejectsOtherStacks(t *testing.T) {
	base := `[{"Id":"abc123","Config":{"Labels":{"com.docker.compose.project":"landing-page-lab","com.docker.compose.service":"db","landing-page.reliability-lab":"true"},"Env":["POSTGRES_DB=reaction_lab","POSTGRES_USER=lab_user"]},"Mounts":[{"Type":"volume","Name":"landing-page-lab_data"}],"NetworkSettings":{"Networks":{"landing-page-lab_default":{}}}}]`
	_, err := ownedContainer([]byte(base), DB)
	must(t, err)
	for _, pair := range [][2]string{
		{"landing-page-lab_data", "landing-page-prod_database"},
		{"landing-page-lab_default", "landing-page-prod_backend"},
		{"reaction_lab", "eventsdb"},
		{`"landing-page.reliability-lab":"true"`, `"landing-page.reliability-lab":"false"`},
		{`"Type":"volume"`, `"Type":"bind"`},
	} {
		if _, err := ownedContainer([]byte(strings.ReplaceAll(base, pair[0], pair[1])), DB); err == nil {
			t.Fatalf("accepted %v", pair)
		}
	}
	var values []container
	must(t, json.Unmarshal([]byte(base), &values))
	values[0].Config.Labels["com.docker.compose.service"] = "api"
	values[0].Config.Env = []string{"DATABASE_URL=" + DatabaseURL}
	values[0].Mounts = nil
	bytes, err := json.Marshal(values)
	must(t, err)
	_, err = ownedContainer(bytes, API)
	must(t, err)
	values[0].Config.Env = []string{"DATABASE_URL=postgresql://prod"}
	bytes, err = json.Marshal(values)
	must(t, err)
	if _, err = ownedContainer(bytes, API); err == nil {
		t.Fatal("accepted other database")
	}
	if _, err = (Docker{}).Inspect(context.Background(), "production"); err == nil {
		t.Fatal("accepted arbitrary service")
	}
}
