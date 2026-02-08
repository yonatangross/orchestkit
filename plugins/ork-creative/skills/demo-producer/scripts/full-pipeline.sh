#!/usr/bin/env bash
# Full Demo Production Pipeline
# Uses ALL skills: terminal-demo-generator, manim-visualizer, remotion-composer
#
# Usage:
#   ./full-pipeline.sh --skill verify --mode real
#   ./full-pipeline.sh --skill explore --mode scripted
#   ./full-pipeline.sh --cast session.cast --skill verify

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/orchestkit-demos"

# Colors
G="\033[32m"; Y="\033[33m"; C="\033[36m"; R="\033[31m"; N="\033[0m"
log() { echo -e "${C}[pipeline]${N} $1"; }
success() { echo -e "${G}✓${N} $1"; }
warn() { echo -e "${Y}⚠${N} $1"; }
error() { echo -e "${R}✗${N} $1"; exit 1; }

# Default values
MODE="scripted"
SKILL_NAME=""
CAST_FILE=""
RENDER_MANIM=false
RENDER_FINAL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skill) SKILL_NAME="$2"; shift 2 ;;
        --mode) MODE="$2"; shift 2 ;;
        --cast) CAST_FILE="$2"; MODE="real"; shift 2 ;;
        --manim) RENDER_MANIM=true; shift ;;
        --render) RENDER_FINAL=true; shift ;;
        -h|--help)
            echo "Full Demo Production Pipeline"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skill NAME     Skill to demo (verify, explore, commit, etc.)"
            echo "  --mode MODE      'real' (asciinema) or 'scripted' (VHS)"
            echo "  --cast FILE      Use existing .cast file (implies --mode real)"
            echo "  --manim          Also render Manim animations"
            echo "  --render         Render final Remotion video"
            echo ""
            echo "Examples:"
            echo "  $0 --skill verify --mode scripted"
            echo "  $0 --skill explore --mode real"
            echo "  $0 --cast my-session.cast --skill verify --manim --render"
            exit 0
            ;;
        *) error "Unknown option: $1" ;;
    esac
done

[[ -z "$SKILL_NAME" ]] && error "Missing --skill argument"

log "Starting full demo pipeline for '${SKILL_NAME}'"
echo ""

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: Terminal Recording (terminal-demo-generator skill)
# ═══════════════════════════════════════════════════════════════════
log "PHASE 1: Terminal Recording"

if [[ "$MODE" == "real" ]]; then
    # Real mode: use asciinema
    if [[ -n "$CAST_FILE" ]] && [[ -f "$CAST_FILE" ]]; then
        success "Using existing cast file: $CAST_FILE"
        TERMINAL_SOURCE="$CAST_FILE"
    else
        log "Recording real session with asciinema..."
        echo ""
        echo -e "${Y}Instructions:${N}"
        echo "  1. Claude Code will start"
        echo "  2. Run: /${SKILL_NAME}"
        echo "  3. Let it complete"
        echo "  4. Type 'exit' to stop recording"
        echo ""
        read -p "Press Enter to start recording..."

        CAST_FILE="${OUTPUT_DIR}/recordings/${SKILL_NAME}-$(date +%Y%m%d-%H%M%S).cast"
        mkdir -p "${OUTPUT_DIR}/recordings"

        asciinema rec \
            --cols 120 \
            --rows 35 \
            --idle-time-limit 2 \
            --title "OrchestKit /${SKILL_NAME} Demo" \
            "$CAST_FILE"

        TERMINAL_SOURCE="$CAST_FILE"
        success "Recording saved: $CAST_FILE"
    fi

    # Convert cast to MP4 via VHS
    log "Converting cast to MP4..."
    cat > "${OUTPUT_DIR}/tapes/convert-${SKILL_NAME}.tape" << EOF
Output ../output/${SKILL_NAME}-demo.mp4
Set Width 1400
Set Height 800
Set FontFamily "Menlo"
Set FontSize 16
Set Theme "Dracula"
Set Framerate 30
Source ${TERMINAL_SOURCE}
EOF

    cd "${OUTPUT_DIR}/tapes"
    vhs "convert-${SKILL_NAME}.tape"
    success "Terminal MP4 created"

else
    # Scripted mode: use VHS scripts
    log "Generating scripted demo..."

    "${SCRIPT_DIR}/generate.sh" skill "$SKILL_NAME" standard horizontal --cinematic

    cd "${OUTPUT_DIR}/tapes"
    TAPE_FILE="sim-${SKILL_NAME}-cinematic.tape"

    if [[ -f "$TAPE_FILE" ]]; then
        vhs "$TAPE_FILE"
        success "Terminal MP4 created"
    else
        error "Tape file not found: $TAPE_FILE"
    fi
fi

# Copy to public folder
cp "${OUTPUT_DIR}/output/${SKILL_NAME}-demo"*.mp4 "${OUTPUT_DIR}/public/${SKILL_NAME}-demo.mp4" 2>/dev/null || true
success "Copied to public/"
echo ""

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: Manim Animations (manim-visualizer skill)
# ═══════════════════════════════════════════════════════════════════
if [[ "$RENDER_MANIM" == "true" ]]; then
    log "PHASE 2: Manim Animations"

    MANIM_DIR="${PROJECT_ROOT}/skills/manim-visualizer/scripts"

    if command -v manim &> /dev/null; then
        cd "$MANIM_DIR"

        # Generate agent spawning animation
        log "Rendering agent spawning animation..."
        python generate.py agent-spawning --preset "$SKILL_NAME" \
            -o "${OUTPUT_DIR}/public/manim/${SKILL_NAME}-agents.mp4" 2>/dev/null || \
            warn "Agent spawning render failed (manim may not be configured)"

        # Generate task dependency animation
        log "Rendering task dependency animation..."
        python generate.py task-dependency --preset "$SKILL_NAME" \
            -o "${OUTPUT_DIR}/public/manim/${SKILL_NAME}-deps.mp4" 2>/dev/null || \
            warn "Task dependency render failed (manim may not be configured)"

        success "Manim animations complete"
    else
        warn "Manim not installed - skipping animations"
        echo "  Install with: pip install manim"
    fi
    echo ""
fi

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: Remotion Composition (remotion-composer skill)
# ═══════════════════════════════════════════════════════════════════
if [[ "$RENDER_FINAL" == "true" ]]; then
    log "PHASE 3: Remotion Composition"

    cd "${OUTPUT_DIR}"

    # Check if composition exists
    COMP_NAME="${SKILL_NAME^}CinematicDemo"  # Capitalize first letter

    log "Rendering ${COMP_NAME}..."
    npx remotion render "$COMP_NAME" "out/${SKILL_NAME}-cinematic-final.mp4" || \
        error "Remotion render failed"

    success "Final video: out/${SKILL_NAME}-cinematic-final.mp4"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}═══════════════════════════════════════════════════════${N}"
echo -e "${G}Pipeline Complete!${N}"
echo -e "${G}═══════════════════════════════════════════════════════${N}"
echo ""
echo "Outputs:"
echo "  Terminal: ${OUTPUT_DIR}/public/${SKILL_NAME}-demo.mp4"
[[ "$RENDER_MANIM" == "true" ]] && echo "  Manim:    ${OUTPUT_DIR}/public/manim/${SKILL_NAME}-*.mp4"
[[ "$RENDER_FINAL" == "true" ]] && echo "  Final:    ${OUTPUT_DIR}/out/${SKILL_NAME}-cinematic-final.mp4"
echo ""
echo "Next steps:"
echo "  Preview:  cd ${OUTPUT_DIR} && npm run preview"
echo "  Render:   npx remotion render ${SKILL_NAME^}CinematicDemo"
