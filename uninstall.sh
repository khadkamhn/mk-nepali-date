#!/usr/bin/env bash
# Uninstall the Nepali Date extension for the current user and remove its settings.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: ./uninstall.sh\n\nUninstalls the Nepali Date GNOME Shell extension (mk-nepali-date@mohankhadka.com.np) for the\ncurrent user: disables and unloads it, removes it from the enabled list, deletes\nits files and resets its settings.\n'
    exit 0
fi

UUID="mk-nepali-date@mohankhadka.com.np"
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
