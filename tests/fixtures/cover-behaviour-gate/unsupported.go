// Fixture for tests/unit/test-cover-behaviour-gate.mjs: a language the checker does not parse.
package pricing

import "testing"

func TestApplyDiscount(t *testing.T) {
	if got := ApplyDiscount(100, 0.2); got != 80 {
		t.Fatalf("got %v", got)
	}
}
