#!/usr/bin/env bash
# Set the Project #5 "Status" of an issue: status.sh <issue-number> <Todo|In progress|Done>
set -euo pipefail
num="$1"; status="$2"
PROJECT_ID=PVT_kwHOAgZ-O84Bm7aR
FIELD_ID=PVTSSF_lAHOAgZ-O84Bm7aRzhliXUM
case "$status" in
  "Todo") opt=$(gh project field-list 5 --owner senrecep --format json -q '.fields[]|select(.name=="Status").options[]|select(.name=="Todo").id');;
  "In progress") opt=$(gh project field-list 5 --owner senrecep --format json -q '.fields[]|select(.name=="Status").options[]|select(.name=="In progress").id');;
  "Done") opt=$(gh project field-list 5 --owner senrecep --format json -q '.fields[]|select(.name=="Status").options[]|select(.name=="Done").id');;
  *) echo "unknown status: $status" >&2; exit 2;;
esac
item=$(gh project item-list 5 --owner senrecep --limit 300 --format json -q ".items[]|select(.content.number==$num).id")
[ -n "$item" ] || { echo "issue #$num not on board" >&2; exit 1; }
gh project item-edit --project-id "$PROJECT_ID" --id "$item" --field-id "$FIELD_ID" --single-select-option-id "$opt" >/dev/null
echo "#$num -> $status"
