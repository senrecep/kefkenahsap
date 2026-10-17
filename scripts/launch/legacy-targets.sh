#!/usr/bin/env bash
# Legacy targets check (#190/#193, docs/LAUNCH.md): every media-map file answers 200 on the CDN, and every
# attachment-map slug's gallery page answers 200 on the site. Read-only (GET/HEAD). Exit 1 on any miss.
#   scripts/launch/legacy-targets.sh <git ref> <cdn base> <site base> [origin ip]
#   dev:        origin/development https://cdn.kefkenahsap.com/dev https://development.kefkenahsap.com
#   prod (2G):  origin/main https://cdn.kefkenahsap.com http://localhost:13000
#   go/no-go:   origin/main https://cdn.kefkenahsap.com https://www.kefkenahsap.com 45.196.28.107   (pre-DNS, via --resolve)
set -euo pipefail
ref=${1:?ref} cdn=${2:?cdn base} site=${3:?site base} ip=${4:-}
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
t=$(mktemp -d); trap 'rm -r "$t"' EXIT
git -C "$repo" show "$ref:src/lib/legacy/media-map.json" | jq -r '.[].file' | sort -u > "$t/files"
git -C "$repo" show "$ref:src/lib/legacy/attachment-map.json" | jq -r '.[].slug' | sort -u > "$t/slugs"
for f in files slugs; do [ "$(wc -l < "$t/$f")" -ge 100 ] || { echo "too few $f in $ref's maps" >&2; exit 1; }; done
extra=()
if [ -n "$ip" ]; then host=$(echo "$site" | sed -E 's#^https?://([^/]+).*#\1#'); extra=(-k --resolve "$host:443:$ip"); fi
check() { xargs -P 8 -I{} curl -s "${@:2}" -o /dev/null -w '%{http_code} {}\n' "$1" | awk '$1!=200'; }
check "$cdn/{}" < "$t/files" > "$t/bad"
check "$site/tr/galeri/{}" "${extra[@]}" < "$t/slugs" >> "$t/bad"
echo "checked $(wc -l < "$t/files") files, $(wc -l < "$t/slugs") gallery pages; broken: $(wc -l < "$t/bad")"
[ ! -s "$t/bad" ] || { cat "$t/bad"; exit 1; }
