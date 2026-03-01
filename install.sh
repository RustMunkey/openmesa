#!/usr/bin/env sh
set -e

BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
DIM="\033[2m"
RESET="\033[0m"

step()  { printf "${CYAN}→${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
die()   { printf "${RED}✗${RESET} %s\n" "$1"; exit 1; }

echo ""
printf "${BOLD}  ✦ Deimos Installer${RESET}\n"
printf "${DIM}  https://github.com/RustMunkey/openmesa${RESET}\n"
echo ""

# ── 1. Verify we're in the project root ───────────────────────────────────────
if [ ! -f "cli/deimos/Cargo.toml" ]; then
  die "Run this script from the root of the openmesa repo."
fi

# ── 2. Rust / cargo ───────────────────────────────────────────────────────────
if command -v cargo >/dev/null 2>&1; then
  ok "Rust $(rustc --version 2>/dev/null | cut -d' ' -f2) already installed"
else
  step "Rust not found — installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  # shellcheck disable=SC1090
  . "$HOME/.cargo/env"
  ok "Rust installed"
fi

# ── 3. Build + install the CLI ────────────────────────────────────────────────
step "Building Deimos CLI..."
cargo install --path cli/deimos --quiet
ok "deimos binary installed to $(which deimos 2>/dev/null || echo '~/.cargo/bin/deimos')"

# ── 4. Ensure ~/.cargo/bin is on PATH ─────────────────────────────────────────
case ":$PATH:" in
  *":$HOME/.cargo/bin:"*) ;;
  *)
    warn "~/.cargo/bin is not in your PATH."
    echo ""
    echo "  Add this to your shell profile (~/.zshrc, ~/.bashrc, etc.):"
    echo ""
    printf "  ${BOLD}export PATH=\"\$HOME/.cargo/bin:\$PATH\"${RESET}\n"
    echo ""
    ;;
esac

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo ""
printf "${GREEN}${BOLD}  Installation complete!${RESET}\n"
echo ""
printf "  Run ${BOLD}deimos setup${RESET} to configure your instance.\n"
echo ""
