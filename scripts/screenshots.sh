#!/usr/bin/env bash
# Regenerate docs/screenshots/*.png in a throwaway headless GNOME Shell.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: scripts/screenshots.sh\n\nStarts a private headless GNOME Shell (stock wallpaper, empty config) with a\ncopy of src/ that opens the calendar, the desktop calendar and the settings\nwindow and saves\nfull-screen screenshots to docs/screenshots/. Your running session and installed extension are untouched.\n'
    exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$ROOT/src/metadata.json")"
OUT="$ROOT/docs/screenshots"
WORK="$(mktemp -d)"
# Wayland socket paths must stay under 108 bytes, so keep the runtime dir short.
RUNTIME="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/nd.XXXX")"
trap 'rm -rf "$WORK" "$RUNTIME"' EXIT

EXT="$WORK/data/gnome-shell/extensions/$UUID"
mkdir -p "$EXT" "$WORK/cfg" "$OUT"
cp -r "$ROOT/src"/. "$EXT"/
glib-compile-schemas "$EXT/schemas"

# Inject a hook into the copy only: open the menu and save screenshots.
# run.sh opens the settings window ~20s in, after the desktop shot; the hook
# shoots it ~6s later.
python3 -I - "$EXT/extension.js" "$OUT" <<'EOF'
import sys
path, out = sys.argv[1], sys.argv[2]
s = open(path).read()
s = s.replace("import St from 'gi://St';",
              "import St from 'gi://St';\nimport Shell from 'gi://Shell';\nimport Gio from 'gi://Gio';", 1)
hook = '''
        const snap = (name, next) => {
            const st = Gio.File.new_for_path(`OUT/${name}.png`).replace(null, false, 0, null);
            new Shell.Screenshot().screenshot(false, st, () => { st.close(null); log('SHOT ' + name); next?.(); });
        };
        const later = (sec, fn) => GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, () => { fn(); return false; });
        this._settings.set_string('language', 'nepali');
        later(5, () => { this._indicator.menu.open(false);
            later(1, () => snap('calendar-nepali', () => {
                this._settings.set_string('language', 'english');
                this._settings.set_boolean('show-weekday', true);
                later(1, () => { this._indicator.menu.open(false);
                    later(1, () => snap('calendar-english', () => {
                        this._indicator.menu.close(false);
                        this._settings.set_string('language', 'nepali');
                        this._settings.set_boolean('show-weekday', false);
                        this._settings.set_boolean('show-desktop-calendar', true);
                        later(1, () => snap('desktop'));
                        later(14, () => snap('prefs'));
                    })); });
            }));
        });
'''.replace('OUT', out)
anchor = "        this._today = null;\n        this._addIndicator();"
if anchor not in s:
    sys.exit('screenshots.sh: hook point not found in extension.js enable()')
open(path, 'w').write(s.replace(anchor, hook + anchor, 1))
EOF

cat > "$WORK/run.sh" <<EOF
#!/bin/bash
gsettings set org.gnome.shell enabled-extensions "['$UUID']"
gsettings set org.gnome.shell disable-user-extensions false
timeout 35 gnome-shell --headless --wayland --no-x11 --virtual-monitor 1920x1080 &
sleep 20
WAYLAND_DISPLAY=wayland-0 gnome-extensions prefs $UUID
wait
EOF
chmod +x "$WORK/run.sh"

env -u WAYLAND_DISPLAY -u DISPLAY \
    XDG_CONFIG_HOME="$WORK/cfg" XDG_DATA_HOME="$WORK/data" XDG_RUNTIME_DIR="$RUNTIME" \
    dbus-run-session "$WORK/run.sh" 2>&1 | grep -E 'SHOT|JS ERROR' || true
ls -la "$OUT"/calendar-*.png "$OUT"/desktop.png "$OUT"/prefs.png
