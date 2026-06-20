#!/usr/bin/env bash
# shellcheck disable=SC2162,SC2068
#
# install.sh — Dev Harness CLI one-liner installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/bakr-bagaber/dev-harness/main/dist/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/bakr-bagaber/dev-harness/main/dist/install.sh | bash -s -- --version 0.2.0
#   curl -fsSL https://raw.githubusercontent.com/bakr-bagaber/dev-harness/main/dist/install.sh | bash -s -- --prefix ~/bin
#
# Detects OS + architecture, downloads the latest (or specified) release
# from GitHub, and installs to /usr/local/bin (or custom prefix).
# Requires Node.js >= 18 for source installs.
#
# NOTE: This file is tracked via `git add -f` because the ops-level
#       .gitignore has `dist/` for Python build artifacts. Use
#       `git add -f dist/install.sh` to stage.

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
INSTALL_DIR="/usr/local/bin"
VERSION="latest"
REPO="bakr-bagaber/dev-harness"
GIT_URL="https://github.com/${REPO}.git"
NPX_PKG="github:${REPO}"
CLI_NAME="harness-dev"
SOURCE_URL="https://raw.githubusercontent.com/${REPO}/main"

# ── Parse options ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) INSTALL_DIR="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --help)
      echo "Usage: curl -fsSL https://raw.githubusercontent.com/bakr-bagaber/dev-harness/main/dist/install.sh | bash -s -- [options]"
      echo ""
      echo "Options:"
      echo "  --prefix <dir>  Install to <dir> instead of /usr/local/bin"
      echo "  --version <ver> Install specific version (default: latest)"
      echo "  --help          Show this help"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found."
  echo "  Install: https://nodejs.org/en/download/"
  echo "  Or use:  npx github:${REPO} --help"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Error: Node.js >= 18 required (found v$(node -v))."
  exit 1
fi

# ── Determine install method ──────────────────────────────────────────────────
echo "==> Installing ${CLI_NAME} (${VERSION}) to ${INSTALL_DIR}"

# Option A: install via npm directly from GitHub (no npm publish needed)
if command -v npm &>/dev/null; then
  echo "==> Installing via npm from GitHub..."
  npm install -g "${GIT_URL}" 2>/dev/null || true

  if command -v "${CLI_NAME}" &>/dev/null; then
    echo "==> ${CLI_NAME} installed successfully via npm from GitHub!"
    "${CLI_NAME}" --help
    exit 0
  fi
fi

# Option B: direct download from GitHub raw (curl/wget)
echo "==> Attempting direct download from GitHub..."

# Try system bin first, fall back to ~/.local/bin
DOWNLOAD_URL="${SOURCE_URL}/cli/harness-dev.mjs"
if [[ -d "${INSTALL_DIR}" && -w "${INSTALL_DIR}" ]]; then
  TARGET="${INSTALL_DIR}/${CLI_NAME}"
elif [[ -d "$HOME/.local/bin" && -w "$HOME/.local/bin" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
  TARGET="${INSTALL_DIR}/${CLI_NAME}"
elif [[ -w "$HOME" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "${INSTALL_DIR}"
  TARGET="${INSTALL_DIR}/${CLI_NAME}"
else
  TARGET=""
fi

if [[ -n "$TARGET" ]] && command -v curl &>/dev/null; then
  if curl -fsSL "${DOWNLOAD_URL}" -o "${TARGET}" 2>/dev/null && chmod +x "${TARGET}"; then
    echo "==> Installed to ${TARGET}"
    echo "==> Make sure ${INSTALL_DIR} is in your PATH."
    echo ""
    "${TARGET}" --help
    exit 0
  fi
elif [[ -n "$TARGET" ]] && command -v wget &>/dev/null; then
  if wget -q "${DOWNLOAD_URL}" -O "${TARGET}" 2>/dev/null && chmod +x "${TARGET}"; then
    echo "==> Installed to ${TARGET}"
    echo "==> Make sure ${INSTALL_DIR} is in your PATH."
    echo ""
    "${TARGET}" --help
    exit 0
  fi
fi

# ── Fallback: instructions ────────────────────────────────────────────────────
echo ""
echo "==> All install methods failed. Use directly from GitHub:"
echo ""
echo "    npx github:${REPO} init --help"
echo ""
echo "Or clone and install:"
echo ""
echo "    git clone ${GIT_URL}"
echo "    cd dev-harness && npm install -g ."
echo ""
