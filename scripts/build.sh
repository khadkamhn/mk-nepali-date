#!/usr/bin/env bash
# Build the zip for uploading to extensions.gnome.org.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: scripts/build.sh\n\nValidates the GSettings schema and builds dist/mk-nepali-date.zip\nfrom src/ for upload to extensions.gnome.org (compiled schemas are left out).\n'
    exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
UUID="$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$SRC/metadata.json")"
OUT="$ROOT/dist/${UUID%@*}.zip"

glib-compile-schemas --strict --dry-run "$SRC/schemas"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
(cd "$SRC" && zip -qr "$OUT" . -x 'schemas/gschemas.compiled')
echo "Built $OUT"
