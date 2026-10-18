#!/usr/bin/env bash
# Set the Project #5 "Status" of an issue: status.sh <issue-number> <Todo|In progress|Done>
# Item ids are cached (one board listing per cache miss) to stay far below GitHub's GraphQL limits.
set -euo pipefail
num="$1"; status="$2"
PROJECT_ID=PVT_kwHOAgZ-O84Bm7aR
FIELD_ID=PVTSSF_lAHOAgZ-O84Bm7aRzhliXUM
declare -A OPT=([Todo]=f75ad846 ["In progress"]=47fc9ee4 [Done]=98236657)
opt="${OPT[$status]:-}"; [ -n "$opt" ] || { echo "unknown status: $status" >&2; exit 2; }
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/kefkenahsap-board-items.json"
lookup() { [ -f "$CACHE" ] && jq -r --arg n "$num" '.[$n] // empty' "$CACHE"; }
item=$(lookup || true)
if [ -z "$item" ]; then
  mkdir -p "$(dirname "$CACHE")"
  gh project item-list 5 --owner senrecep --limit 300 --format json \
    | jq '[.items[] | {key: (.content.number|tostring), value: .id}] | from_entries' > "$CACHE"
  item=$(lookup || true)
fi
[ -n "$item" ] || { echo "issue #$num not on board" >&2; exit 1; }
gh project item-edit --project-id "$PROJECT_ID" --id "$item" --field-id "$FIELD_ID" --single-select-option-id "$opt" >/dev/null
echo "#$num -> $status"
