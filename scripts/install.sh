#!/usr/bin/env bash
# Install (or reinstall) the extension from src/ for the current user.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: scripts/install.sh\n\nInstalls (or reinstalls) the Nepali Date GNOME Shell extension from src/ for\nthe current user. On Wayland, log out and back in for GNOME Shell to load it.\n'
    exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
UUID="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$SRC/metadata.json")"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$SRC"/. "$DEST"/
glib-compile-schemas "$DEST/schemas"
echo "Installed to $DEST"
echo "Log out and back in (Wayland), then run: gnome-extensions enable $UUID"
