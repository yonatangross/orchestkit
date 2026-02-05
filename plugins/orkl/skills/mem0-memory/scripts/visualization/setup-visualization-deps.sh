#!/usr/bin/env bash
# Setup visualization dependencies for Mem0 graph visualization
# Installs plotly, networkx, matplotlib, kaleido

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Python version
log "Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    log_error "Python 3.11+ required. Found: $PYTHON_VERSION"
    exit 1
fi

log_success "Python version: $PYTHON_VERSION"

# Check if virtual environment should be used
USE_VENV=false
if [ -d ".venv" ]; then
    log "Found existing .venv directory"
    USE_VENV=true
elif [ "${USE_VENV:-}" = "true" ]; then
    log "Creating virtual environment..."
    python3 -m venv .venv
    USE_VENV=true
    if [ ! -f ".gitignore" ] || ! grep -q "^\.venv$" .gitignore; then
        echo ".venv" >> .gitignore
        log "Added .venv to .gitignore"
    fi
fi

# Activate venv if using it
if [ "$USE_VENV" = true ]; then
    log "Activating virtual environment..."
    source .venv/bin/activate
    PYTHON_CMD="python"
    PIP_CMD="pip"
else
    log_warn "Using system Python. Consider using virtual environment for isolation."
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
    
    # Check if --user flag is needed
    if ! $PIP_CMD install --help | grep -q "\-\-user"; then
        log_warn "pip --user flag not available, installing globally"
        INSTALL_FLAG=""
    else
        log "Using --user flag for system-wide install"
        INSTALL_FLAG="--user"
    fi
fi

# Install dependencies
log "Installing visualization dependencies..."
DEPENDENCIES=(
    "plotly>=5.18.0"
    "networkx>=3.2.0"
    "matplotlib>=3.8.0"
    "kaleido>=0.2.1"
)

for dep in "${DEPENDENCIES[@]}"; do
    log "Installing $dep..."
    $PIP_CMD install $INSTALL_FLAG "$dep" --quiet
done

# Verify installation
log "Verifying installation..."
$PYTHON_CMD -c "import plotly; print(f'plotly {plotly.__version__}')" || {
    log_error "Failed to import plotly"
    exit 1
}

$PYTHON_CMD -c "import networkx; print(f'networkx {networkx.__version__}')" || {
    log_error "Failed to import networkx"
    exit 1
}

$PYTHON_CMD -c "import matplotlib; print(f'matplotlib {matplotlib.__version__}')" || {
    log_error "Failed to import matplotlib"
    exit 1
}

$PYTHON_CMD -c "import kaleido; print('kaleido installed')" || {
    log_warn "kaleido import failed (may still work for static exports)"
}

log_success "All dependencies installed successfully!"

if [ "$USE_VENV" = true ]; then
    log "To activate virtual environment in future sessions:"
    echo "  source .venv/bin/activate"
fi

log_success "Setup complete! You can now use visualization tools."
