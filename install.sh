#!/usr/bin/env bash
# wheel-momentum installer
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"
DATA="$HOME/.local/share/wheel-momentum"
VENV="$DATA/venv"
UNITS="$HOME/.config/systemd/user"
CONF="$HOME/.config/wheel-momentum"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }

need() {
    command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }
}

need python3
need systemctl

say "Python environment: $VENV"
mkdir -p "$DATA"
if [ ! -x "$VENV/bin/python" ]; then
    python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip >/dev/null 2>&1 || true
"$VENV/bin/pip" install --quiet --upgrade evdev

say "Installing executables into $BIN"
mkdir -p "$BIN"
install -m 755 "$SRC/daemon/wheel-momentum" "$BIN/wheel-momentum"
install -m 755 "$SRC/tray/wheel-momentum-tray" "$BIN/wheel-momentum-tray"
# The daemon needs python-evdev from the venv, the tray uses the system python.
sed -i "1s|^#!.*|#!$VENV/bin/python|" "$BIN/wheel-momentum"

say "Installing systemd user units"
mkdir -p "$UNITS"
install -m 644 "$SRC/systemd/wheel-momentum.service" "$UNITS/"
install -m 644 "$SRC/systemd/wheel-momentum-tray.service" "$UNITS/"
systemctl --user daemon-reload

say "Default config: $CONF/config.json"
mkdir -p "$CONF"
if [ ! -f "$CONF/config.json" ]; then
    cp "$SRC/examples/config.json" "$CONF/config.json"
fi

if [ ! -w /dev/uinput ]; then
    warn "/dev/uinput is not writable by $USER. Add yourself to the 'input' group"
    warn "and/or install a udev rule - see the README (Permissions)."
fi

say "Enabling services"
systemctl --user enable --now wheel-momentum-tray.service
systemctl --user enable wheel-momentum.service
systemctl --user restart wheel-momentum.service

say "Done."
echo "  tray / settings : $BIN/wheel-momentum-tray --show"
echo "  daemon status   : systemctl --user status wheel-momentum"
echo "  logs            : journalctl --user -u wheel-momentum -f"
