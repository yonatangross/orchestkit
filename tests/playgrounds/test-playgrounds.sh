#!/bin/bash
# Playgrounds E2E Tests
# Validates HTML structure, JavaScript data integrity, and component functionality
#
# Test Count: 50
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

  # Verify compositions have required fields (thumbnail is optional - added when video is rendered)
  node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$data_file', 'utf8');
    global.window = {};
    eval(code);
    const data = window.ORCHESTKIT_DATA;

    const requiredFields = ['id', 'skill', 'style', 'format', 'width', 'height', 'fps', 'durationSeconds', 'folder'];

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

  # Verify totals object exists (static or getter)
  assert_file_contains "$data_file" 'totals'

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

  # Skip if cdn-urls.json doesn't exist (CDN URLs are optional for manual data.js)
  if [[ ! -f "$cdn_file" ]]; then
    skip "cdn-urls.json not found"
  fi

  # Skip for two-tier system - data.js is manually maintained
  # CDN URLs are added separately when demos are rendered
  skip "CDN URL sync skipped for two-tier system (manual data.js)"
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
# URL UTILITIES TESTS (orkUrl)
# ============================================================================

describe "URL Utilities (orkUrl)"

test_orkurl_getparams_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'getParams:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'decodeURIComponent'
}

test_orkurl_setparams_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'setParams:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'replaceState'
}

test_orkurl_getcompurl_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'getCompUrl:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'encodeURIComponent'
}

test_orkurl_excludes_default_values() {
  # setParams should exclude 'all', empty, and null values
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "!== 'all'"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "!== ''"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "!== null"
}

# ============================================================================
# BREADCRUMB UTILITIES TESTS (orkBreadcrumbs)
# ============================================================================

describe "Breadcrumb Utilities (orkBreadcrumbs)"

test_orkbreadcrumbs_hierarchy_defined() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'orkBreadcrumbs'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'hierarchy'
}

test_orkbreadcrumbs_has_all_pages() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "'index.html'"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "'demo-gallery.html'"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "'marketplace-explorer.html'"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "'setup-wizard.html'"
}

test_orkbreadcrumbs_build_function_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'build:'
}

test_orkbreadcrumbs_render_function_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'render:'
}

test_orkbreadcrumbs_has_aria_current() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'aria-current'
}

# ============================================================================
# SHARE UTILITIES TESTS (orkShare)
# ============================================================================

describe "Share Utilities (orkShare)"

test_orkshare_twitter_function_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'twitter:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'twitter.com/intent/tweet'
}

test_orkshare_linkedin_function_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'linkedin:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'linkedin.com/sharing'
}

test_orkshare_copyurl_with_fallback() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'copyUrl:'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'navigator.clipboard'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'execCommand'
}

test_orkshare_getcompshareretext_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'getCompShareText:'
}

test_orkshare_renderbuttons_exists() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'renderButtons:'
}

test_orkshare_has_aria_labels() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'aria-label'
}

# ============================================================================
# DEEP LINKING TESTS
# ============================================================================

describe "Deep Linking"

test_demo_gallery_reads_url_params() {
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'orkUrl.getParams()'
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'urlParams.comp'
}

test_demo_gallery_auto_opens_modal() {
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'if (urlParams.comp)'
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'openModal(urlParams.comp)'
}

test_index_reads_url_params() {
  assert_file_contains "$PLAYGROUNDS_DIR/index.html" 'orkUrl.getParams()'
}

test_setup_wizard_applies_preset_from_url() {
  assert_file_contains "$PLAYGROUNDS_DIR/setup-wizard.html" 'urlParams.preset'
  assert_file_contains "$PLAYGROUNDS_DIR/setup-wizard.html" 'applyPreset(urlParams.preset)'
}

test_marketplace_reads_view_param() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'urlParams.view'
}

test_all_pages_have_synctourl() {
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'syncToUrl()'
  assert_file_contains "$PLAYGROUNDS_DIR/index.html" 'syncToUrl()'
  assert_file_contains "$PLAYGROUNDS_DIR/setup-wizard.html" 'syncToUrl()'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'syncToUrl()'
}

test_all_pages_have_breadcrumbs() {
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'updateBreadcrumbs()'
  assert_file_contains "$PLAYGROUNDS_DIR/index.html" 'updateBreadcrumbs()'
  assert_file_contains "$PLAYGROUNDS_DIR/setup-wizard.html" 'updateBreadcrumbs()'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'updateBreadcrumbs()'
}

# ============================================================================
# MARKETPLACE INLINE DETAIL TESTS
# ============================================================================

describe "Marketplace Inline Details"

test_marketplace_has_inline_detail_css() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'tag-detail'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'tag-detail-header'
}

test_marketplace_skills_are_clickable() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" "showDetail"
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'event.stopPropagation()'
}

test_marketplace_agents_are_clickable() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" "agent-tag"
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" "cursor:pointer"
}

test_marketplace_commands_are_clickable() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" "command-tag"
}

test_marketplace_detail_has_close() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'closeDetail'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'tag-detail-close'
}

test_marketplace_detail_escape_closes() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" "if (e.key === 'Escape') closeDetail()"
}

test_marketplace_filter_buttons_have_gap() {
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" '#categoryFilters'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" 'gap: 8px'
}

# ============================================================================
# DEMO GALLERY UX TESTS
# ============================================================================

describe "Demo Gallery UX"

test_demo_gallery_no_render_command() {
  # Render command section should be removed (dev-only feature)
  if grep -q 'render-cmd' "$PLAYGROUNDS_DIR/demo-gallery.html"; then
    fail "render-cmd section should be removed from demo-gallery.html"
  fi
  if grep -q 'Render Command' "$PLAYGROUNDS_DIR/demo-gallery.html"; then
    fail "Render Command label should be removed from demo-gallery.html"
  fi
}

test_demo_gallery_variant_spacing() {
  # Variants should have proper gap spacing
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'gap: 8px'
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" 'margin-bottom: 2px'
}

# ============================================================================
# ACCESSIBILITY TESTS
# ============================================================================

describe "Accessibility"

test_nav_has_aria_label() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "aria-label"
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" "role"
}

test_breadcrumbs_container_is_nav() {
  # All pages should use nav element for breadcrumbs
  assert_file_contains "$PLAYGROUNDS_DIR/demo-gallery.html" '<nav class="ork-breadcrumbs"'
  assert_file_contains "$PLAYGROUNDS_DIR/index.html" '<nav class="ork-breadcrumbs"'
  assert_file_contains "$PLAYGROUNDS_DIR/setup-wizard.html" '<nav class="ork-breadcrumbs"'
  assert_file_contains "$PLAYGROUNDS_DIR/marketplace-explorer.html" '<nav class="ork-breadcrumbs"'
}

test_share_buttons_have_aria_labels() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'aria-label="Share on Twitter"'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'aria-label="Share on LinkedIn"'
  assert_file_contains "$PLAYGROUNDS_DIR/nav.js" 'aria-label="Copy link'
}

test_focus_visible_styles_exist() {
  assert_file_contains "$PLAYGROUNDS_DIR/nav.css" ':focus-visible'
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

run_tests
