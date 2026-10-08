#!/usr/bin/env bash
# Uninstall the Nepali Date extension for the current user and remove its settings.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: scripts/uninstall.sh\n\nUninstalls the Nepali Date GNOME Shell extension for the current user: disables\nand unloads it, removes it from the enabled list, deletes its files and resets\nits settings.\n'
    exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$ROOT/src/metadata.json")"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
SETTINGS_PATH="/org/gnome/shell/extensions/mk-nepali-date/"

# Ask the running shell to unload and delete it (removes it from the top bar immediately).
if gnome-extensions info "$UUID" >/dev/null 2>&1; then
    gnome-extensions disable "$UUID" || true
    gnome-extensions uninstall "$UUID" || true
fi

# Fallbacks in case the shell isn't running or didn't know about it.
enabled="$(gsettings get org.gnome.shell enabled-extensions)"
cleaned="$(printf '%s' "$enabled" | sed -E "s/, '$UUID'|'$UUID', |'$UUID'//")"
if [ "$enabled" != "$cleaned" ]; then
    gsettings set org.gnome.shell enabled-extensions "$cleaned"
fi
rm -rf "$DEST"
dconf reset -f "$SETTINGS_PATH"

echo "Uninstalled $UUID"
