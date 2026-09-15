package sdk

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/search" {
			t.Fatalf("path %s", r.URL.Path)
		}
		w.Header().Set("RateLimit-Limit", "120")
		w.Header().Set("RateLimit-Remaining", "119")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]string{{"id": "a", "url": "https://orchestkit.yonyon.ai/x", "title": "X"}},
		})
	}))
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	hits, rl, err := c.Search("hooks", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0].ID != "a" {
		t.Fatalf("hits %+v", hits)
	}
	if rl.Limit == nil || *rl.Limit != 120 {
		t.Fatalf("ratelimit %+v", rl)
	}
}

func TestReadDocNormalizes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/docs/foundations/overview.md" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte("# hi"))
	}))
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	text, _, err := c.ReadDoc("foundations/overview.md")
	if err != nil {
		t.Fatal(err)
	}
	if text != "# hi" {
		t.Fatalf("got %q", text)
	}
}

func TestAPIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		_ = json.NewEncoder(w).Encode(map[string]any{"title": "gone", "detail": "missing", "status": 404})
	}))
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	_, _, err := c.Search("x", 1)
	ae, ok := err.(*APIError)
	if !ok {
		t.Fatalf("want APIError, got %T %v", err, err)
	}
	if ae.Status != 404 || ae.Problem.Detail != "missing" {
		t.Fatalf("%+v", ae)
	}
}
