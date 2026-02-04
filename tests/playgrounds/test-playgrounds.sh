#!/bin/bash
# Playgrounds E2E Tests
# Validates HTML structure, JavaScript data integrity, and component functionality
#
# Test Count: 15
# Priority: MEDIUM
# Purpose: Ensure playgrounds render correctly and data flows properly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAYGROUNDS_DIR="$PROJECT_ROOT/docs/playgrounds"

# Source test helpers
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# ============================================================================
# DEMO GALLERY TESTS
# ============================================================================

describe "Demo Gallery (demo-gallery.html)"

test_demo_gallery_has_composition_cards() {
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"

  assert_file_exists "$html_file"

  # Check for composition card grid
  assert_file_contains "$html_file" 'comp-grid'
  assert_file_contains "$html_file" 'comp-card'

  # Check for card structure elements
  assert_file_contains "$html_file" 'comp-thumb'
  assert_file_contains "$html_file" 'comp-info'
  assert_file_contains "$html_file" 'comp-tags'
}

test_demo_gallery_has_modal_structure() {
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"

  # Check modal overlay and modal elements
  assert_file_contains "$html_file" 'modal-overlay'
  assert_file_contains "$html_file" 'modal-thumb'
  assert_file_contains "$html_file" 'modal-body'
  assert_file_contains "$html_file" 'modal-close'
}

test_demo_gallery_has_play_button_for_videos() {
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"

  # Check for play button overlay (shown when videoCdn exists)
  assert_file_contains "$html_file" 'play-overlay'
  assert_file_contains "$html_file" 'play-btn'

  # Check for video playback function
  assert_file_contains "$html_file" 'playVideo'
  assert_file_contains "$html_file" 'modal-video'
}

test_demo_gallery_filters_work() {
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"

  # Check for filter structure
  assert_file_contains "$html_file" 'filters'
  assert_file_contains "$html_file" 'search-box'
  assert_file_contains "$html_file" 'formatFilters'
  assert_file_contains "$html_file" 'styleFilters'

  # Check for filter function
  assert_file_contains "$html_file" 'setFilter'
  assert_file_contains "$html_file" 'getFiltered'
}

test_demo_gallery_modal_close_functionality() {
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"

  # Check for modal close function
  assert_file_contains "$html_file" 'closeModal'

  # Check for escape key handler
  assert_file_contains "$html_file" "keydown"
  assert_file_contains "$html_file" "Escape"
}

# ============================================================================
# HUB (INDEX) TESTS
# ============================================================================

describe "Hub (index.html)"

test_hub_has_dynamic_stats() {
  local html_file="$PLAYGROUNDS_DIR/index.html"

  assert_file_exists "$html_file"

  # Check for stats row element
  assert_file_contains "$html_file" 'stats-row'
  assert_file_contains "$html_file" 'statsRow'

  # Check that stats are calculated from totals object (dynamic, not hardcoded)
  # Uses bracket notation: totals[key]
  assert_file_contains "$html_file" 'totals['
  assert_file_contains "$html_file" 'data.totals'
}

test_hub_has_demo_compositions_section() {
  local html_file="$PLAYGROUNDS_DIR/index.html"

  # Check for preview section
  assert_file_contains "$html_file" 'preview-section'
  assert_file_contains "$html_file" 'Demo Compositions'
  assert_file_contains "$html_file" 'previewScroll'
  assert_file_contains "$html_file" 'preview-card'
}

test_hub_has_composition_modal() {
  local html_file="$PLAYGROUNDS_DIR/index.html"

  # Check for composition modal
  assert_file_contains "$html_file" 'openCompModal'
  assert_file_contains "$html_file" 'closeCompModal'
  assert_file_contains "$html_file" 'playCompVideo'

  # Check for modal elements
  assert_file_contains "$html_file" 'comp-modal'
  assert_file_contains "$html_file" 'comp-play-btn'
}

test_hub_shows_play_indicator_for_videos() {
  local html_file="$PLAYGROUNDS_DIR/index.html"

  # Check for play indicator shown when hasVideo
  assert_file_contains "$html_file" 'play-indicator'
  assert_file_contains "$html_file" 'hasVideo'
}

test_hub_links_to_other_playgrounds() {
  local html_file="$PLAYGROUNDS_DIR/index.html"
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Check for direct link to demo gallery
  assert_file_contains "$html_file" 'demo-gallery.html'

  # Other pages are referenced via data.pages array (loaded from data.js)
  # Verify they exist in data.js
  assert_file_contains "$data_file" 'marketplace-explorer.html'
  assert_file_contains "$data_file" 'setup-wizard.html'

  # Verify index.html uses data.pages for navigation
  assert_file_contains "$html_file" 'data.pages'
}

# ============================================================================
# SETUP WIZARD TESTS
# ============================================================================

describe "Setup Wizard (setup-wizard.html)"

test_wizard_has_welcome_screen() {
  local html_file="$PLAYGROUNDS_DIR/setup-wizard.html"

  assert_file_exists "$html_file"

  # Check for welcome screen
  assert_file_contains "$html_file" 'welcome-screen'
  assert_file_contains "$html_file" 'welcomeScreen'
  assert_file_contains "$html_file" 'Welcome to OrchestKit'
}

test_wizard_has_dynamic_welcome_stats() {
  local html_file="$PLAYGROUNDS_DIR/setup-wizard.html"

  # Check that welcome features use dynamic totals
  assert_file_contains "$html_file" 'welcomeFeatures'
  assert_file_contains "$html_file" 'totals.skills'
  assert_file_contains "$html_file" 'totals.agents'
  assert_file_contains "$html_file" 'totals.hooks'

  # Check for initWelcomeScreen function
  assert_file_contains "$html_file" 'initWelcomeScreen'
}

test_wizard_get_started_flow() {
  local html_file="$PLAYGROUNDS_DIR/setup-wizard.html"

  # Check for Get Started button and function
  assert_file_contains "$html_file" 'Get Started'
  assert_file_contains "$html_file" 'startWizard'

  # Check for wizard content section
  assert_file_contains "$html_file" 'wizardContent'
  assert_file_contains "$html_file" 'wizard-content'
}

test_wizard_has_presets() {
  local html_file="$PLAYGROUNDS_DIR/setup-wizard.html"

  # Check for preset buttons
  assert_file_contains "$html_file" 'preset-bar'
  assert_file_contains "$html_file" 'applyPreset'

  # Check for specific presets
  assert_file_contains "$html_file" 'minimal'
  assert_file_contains "$html_file" 'backend'
  assert_file_contains "$html_file" 'frontend'
  assert_file_contains "$html_file" 'fullstack'
}

test_wizard_has_skip_to_presets() {
  local html_file="$PLAYGROUNDS_DIR/setup-wizard.html"

  # Check for skip functionality
  assert_file_contains "$html_file" 'skipToPresets'
  assert_file_contains "$html_file" 'Jump to presets'
}

# ============================================================================
# DATA.JS INTEGRITY TESTS
# ============================================================================

describe "Data Layer (data.js)"

test_data_js_has_valid_syntax() {
  local data_file="$PLAYGROUNDS_DIR/data.js"

  assert_file_exists "$data_file"

  # Verify data.js can be parsed by Node
  node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(code);
    if (!window.ORCHESTKIT_DATA) throw new Error('ORCHESTKIT_DATA not defined');
    console.log('Valid');
  " || fail "data.js has invalid syntax"
}

test_data_js_has_required_sections() {
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Check for required sections
  assert_file_contains "$data_file" 'plugins:'
  assert_file_contains "$data_file" 'agents:'
  assert_file_contains "$data_file" 'compositions:'
  assert_file_contains "$data_file" 'categories:'
  assert_file_contains "$data_file" 'totals'
  assert_file_contains "$data_file" 'pages:'
}

test_data_js_compositions_have_required_fields() {
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Verify compositions have required fields
  node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(code);
    const data = window.ORCHESTKIT_DATA;

    const requiredFields = ['id', 'skill', 'style', 'format', 'width', 'height', 'fps', 'durationSeconds', 'folder', 'thumbnail'];

    for (const comp of data.compositions) {
      for (const field of requiredFields) {
        if (comp[field] === undefined) {
          throw new Error('Composition ' + comp.id + ' missing field: ' + field);
        }
      }
    }
    console.log('All compositions have required fields');
  " || fail "Some compositions are missing required fields"
}

test_data_js_totals_are_calculated() {
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Verify totals are calculated dynamically (getter function)
  assert_file_contains "$data_file" 'get totals()'

  # Verify totals include all expected keys
  node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(code);
    const totals = window.ORCHESTKIT_DATA.totals;

    const requiredKeys = ['plugins', 'skills', 'agents', 'hooks', 'commands', 'compositions'];
    for (const key of requiredKeys) {
      if (totals[key] === undefined) {
        throw new Error('totals missing key: ' + key);
      }
      if (typeof totals[key] !== 'number') {
        throw new Error('totals.' + key + ' should be a number');
      }
    }
    console.log('Totals: ' + JSON.stringify(totals));
  " || fail "Totals calculation failed"
}

# ============================================================================
# CDN URLS SYNC TESTS
# ============================================================================

describe "CDN URLs Sync"

test_cdn_urls_present_in_data_js() {
  local cdn_file="$PROJECT_ROOT/orchestkit-demos/out/cdn-urls.json"
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Skip if cdn-urls.json doesn't exist
  if [[ ! -f "$cdn_file" ]]; then
    skip "cdn-urls.json not found"
  fi

  # Check that video compositions from cdn-urls.json have their URLs in data.js
  node -e "
    const fs = require('fs');
    const cdnUrls = JSON.parse(fs.readFileSync('$cdn_file', 'utf8'));
    const dataCode = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(dataCode);
    const data = window.ORCHESTKIT_DATA;

    let errors = [];
    let checked = 0;

    for (const [id, urls] of Object.entries(cdnUrls)) {
      // Find matching composition
      const comp = data.compositions.find(c => c.id === id);
      if (!comp) continue;

      checked++;

      // Check thumbnailCdn matches
      if (urls.thumbnailCdn && comp.thumbnailCdn !== urls.thumbnailCdn) {
        errors.push(id + ': thumbnailCdn mismatch');
      }

      // Check videoCdn matches
      if (urls.videoCdn && comp.videoCdn !== urls.videoCdn) {
        errors.push(id + ': videoCdn mismatch');
      }
    }

    if (errors.length > 0) {
      console.error('CDN URL mismatches:');
      errors.forEach(e => console.error('  - ' + e));
      process.exit(1);
    }

    console.log('Checked ' + checked + ' compositions - all CDN URLs in sync');
  " || fail "CDN URLs out of sync with data.js"
}

test_video_cdn_compositions_have_play_overlay() {
  local data_file="$PLAYGROUNDS_DIR/data.js"

  # Count compositions with videoCdn
  local video_count=$(node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(code);
    const data = window.ORCHESTKIT_DATA;
    const withVideo = data.compositions.filter(c => c.videoCdn);
    console.log(withVideo.length);
  ")

  if [[ $video_count -eq 0 ]]; then
    skip "No compositions with videoCdn found"
  fi

  # Verify demo-gallery.html handles videoCdn properly
  local html_file="$PLAYGROUNDS_DIR/demo-gallery.html"
  assert_file_contains "$html_file" 'videoCdn'
  assert_file_contains "$html_file" 'comp.videoCdn'

  echo "Found $video_count compositions with video"
}

# ============================================================================
# HTML STRUCTURE VALIDATION
# ============================================================================

describe "HTML Structure Validation"

test_all_html_files_have_doctype() {
  local errors=0

  for html_file in "$PLAYGROUNDS_DIR"/*.html; do
    if ! grep -q '<!DOCTYPE html>' "$html_file"; then
      echo "Missing DOCTYPE: $(basename "$html_file")"
      ((errors++)) || true
    fi
  done

  if [[ $errors -gt 0 ]]; then
    fail "$errors HTML files missing DOCTYPE"
  fi
}

test_all_html_files_properly_closed() {
  local errors=0

  for html_file in "$PLAYGROUNDS_DIR"/*.html; do
    local filename=$(basename "$html_file")

    if ! grep -q '</html>' "$html_file"; then
      echo "Missing </html>: $filename"
      ((errors++)) || true
    fi

    if ! grep -q '</head>' "$html_file"; then
      echo "Missing </head>: $filename"
      ((errors++)) || true
    fi

    if ! grep -q '</body>' "$html_file"; then
      echo "Missing </body>: $filename"
      ((errors++)) || true
    fi
  done

  if [[ $errors -gt 0 ]]; then
    fail "$errors HTML structure errors found"
  fi
}

test_all_html_files_load_data_js() {
  local errors=0

  # These pages should load data.js
  local pages_requiring_data=(
    "demo-gallery.html"
    "index.html"
    "setup-wizard.html"
    "marketplace-explorer.html"
  )

  for page in "${pages_requiring_data[@]}"; do
    local html_file="$PLAYGROUNDS_DIR/$page"
    if [[ -f "$html_file" ]]; then
      if ! grep -q 'src="data.js"' "$html_file"; then
        echo "Missing data.js include: $page"
        ((errors++)) || true
      fi
    fi
  done

  if [[ $errors -gt 0 ]]; then
    fail "$errors HTML files missing data.js include"
  fi
}

test_all_html_files_have_navigation() {
  local errors=0

  # Check for nav.js include (shared navigation)
  for html_file in "$PLAYGROUNDS_DIR"/*.html; do
    local filename=$(basename "$html_file")
    if ! grep -q 'nav.js' "$html_file" && ! grep -q 'nav.css' "$html_file"; then
      echo "WARNING: $filename may be missing navigation"
    fi
  done

  # Verify nav.js exists
  assert_file_exists "$PLAYGROUNDS_DIR/nav.js"
  assert_file_exists "$PLAYGROUNDS_DIR/nav.css"
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

run_tests
