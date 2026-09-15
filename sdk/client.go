// Package sdk is the official Go client for the OrchestKit public docs API.
// Homepage: https://orchestkit.yonyon.ai
package sdk

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const DefaultBaseURL = "https://orchestkit.yonyon.ai"
const userAgent = "orchestkit-go/0.1.0"

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

type RateLimit struct {
	Limit     *int
	Remaining *int
	Reset     *int
}

type SearchHit struct {
	ID          string `json:"id"`
	URL         string `json:"url"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
}

type Problem struct {
	Type   string `json:"type,omitempty"`
	Title  string `json:"title,omitempty"`
	Status int    `json:"status,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type APIError struct {
	Status     int
	Problem    Problem
	RetryAfter *int
}

func (e *APIError) Error() string {
	if e.Problem.Detail != "" {
		return e.Problem.Detail
	}
	if e.Problem.Title != "" {
		return e.Problem.Title
	}
	return fmt.Sprintf("HTTP %d", e.Status)
}

func NewClient() *Client {
	base := os.Getenv("ORCHESTKIT_BASE_URL")
	if base == "" {
		base = DefaultBaseURL
	}
	return &Client{
		BaseURL:    strings.TrimRight(base, "/"),
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func intHeader(h http.Header, name string) *int {
	raw := h.Get(name)
	if raw == "" {
		return nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return nil
	}
	return &n
}

func rateLimit(h http.Header) RateLimit {
	return RateLimit{
		Limit:     intHeader(h, "RateLimit-Limit"),
		Remaining: intHeader(h, "RateLimit-Remaining"),
		Reset:     intHeader(h, "RateLimit-Reset"),
	}
}

func (c *Client) get(path, accept string) ([]byte, RateLimit, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return nil, RateLimit{}, err
	}
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", userAgent)
	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, RateLimit{}, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, RateLimit{}, err
	}
	rl := rateLimit(res.Header)
	if res.StatusCode >= 400 {
		p := Problem{Status: res.StatusCode, Title: res.Status}
		_ = json.Unmarshal(body, &p)
		return nil, rl, &APIError{Status: res.StatusCode, Problem: p, RetryAfter: intHeader(res.Header, "Retry-After")}
	}
	return body, rl, nil
}

func (c *Client) Search(query string, limit int) ([]SearchHit, RateLimit, error) {
	q := url.Values{}
	q.Set("query", query)
	q.Set("limit", strconv.Itoa(limit))
	body, rl, err := c.get("/api/search?"+q.Encode(), "application/json")
	if err != nil {
		return nil, rl, err
	}
	var parsed struct {
		Results []SearchHit `json:"results"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, rl, err
	}
	return parsed.Results, rl, nil
}

func (c *Client) Ask(query string) (json.RawMessage, RateLimit, error) {
	q := url.Values{}
	q.Set("query", query)
	body, rl, err := c.get("/ask?"+q.Encode(), "application/json")
	return body, rl, err
}

func (c *Client) ReadDoc(slug string) (string, RateLimit, error) {
	clean := strings.TrimSuffix(strings.TrimSpace(slug), ".md")
	if !strings.HasPrefix(clean, "/") {
		clean = "/docs/" + clean
	}
	if !strings.HasPrefix(clean, "/docs") {
		clean = "/docs" + clean
	}
	body, rl, err := c.get(clean+".md", "text/markdown")
	if err != nil {
		return "", rl, err
	}
	return string(body), rl, nil
}
