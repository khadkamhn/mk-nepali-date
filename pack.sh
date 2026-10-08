#!/usr/bin/env bash
# Build the zip for uploading to extensions.gnome.org.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    printf 'Usage: ./pack.sh\n\nBuilds mk-nepali-date.zip for upload to extensions.gnome.org, leaving out\ncompiled schemas.\n'
    exit 0
fi

UUID="mk-nepali-date@mohankhadka.com.np"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/mk-nepali-date.zip"

rm -f "$OUT"
(cd "$DIR/$UUID" && zip -r "$OUT" . -x 'schemas/gschemas.compiled')
echo "Built $OUT"
