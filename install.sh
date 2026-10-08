#!/usr/bin/env bash
# Install (or reinstall) the Nepali Date extension for the current user.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: ./install.sh\n\nInstalls (or reinstalls) the Nepali Date GNOME Shell extension (mk-nepali-date@mohankhadka.com.np)\nfor the current user. On Wayland, log out and back in for GNOME Shell to load it.\n'
    exit 0
fi

UUID="mk-nepali-date@mohankhadka.com.np"
SRC="$(cd "$(dirname "$0")/$UUID" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$SRC"/. "$DEST"/
glib-compile-schemas "$DEST/schemas"
echo "Installed to $DEST"
echo "Log out and back in (Wayland), then run: gnome-extensions enable $UUID"
