#!/usr/bin/env bash
# wheel-momentum uninstaller
set -euo pipefail

BIN="$HOME/.local/bin"
DATA="$HOME/.local/share/wheel-momentum"
UNITS="$HOME/.config/systemd/user"
CONF="$HOME/.config/wheel-momentum"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

say "Stopping and disabling services"
systemctl --user disable --now wheel-momentum-tray.service 2>/dev/null || true
systemctl --user disable --now wheel-momentum.service 2>/dev/null || true

say "Removing units"
rm -f "$UNITS/wheel-momentum.service" "$UNITS/wheel-momentum-tray.service"
systemctl --user daemon-reload 2>/dev/null || true

say "Removing executables"
rm -f "$BIN/wheel-momentum" "$BIN/wheel-momentum-tray"

say "Removing icons and cache"
rm -f "$HOME"/.local/share/icons/hicolor/*/apps/wheel-momentum-*.png 2>/dev/null || true
rm -rf "$HOME/.cache/wheel-momentum"

if [ "${1:-}" = "--purge" ]; then
    say "Removing config (--purge)"
    rm -rf "$CONF"
fi

say "Removing Python environment"
rm -rf "$DATA"

say "Done."
[ "${1:-}" = "--purge" ] || echo "Your config in $CONF was kept; use --purge to remove it."
