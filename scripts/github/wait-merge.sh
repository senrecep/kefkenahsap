#!/usr/bin/env bash
# wait-merge.sh <pr> [comment] — wait for the "check" job, then squash-merge on pass.
set -uo pipefail
pr="$1"; comment="${2:-}"; R=senrecep/kefkenahsap
s=""
until [ "$s" = pass ] || [ "$s" = fail ]; do
  sleep 15
  s=$(gh pr checks "$pr" -R $R 2>/dev/null | awk '$1=="check"{print $2}')
done
echo "check=$s"
[ "$s" = pass ] || exit 1
[ -n "$comment" ] && gh pr comment "$pr" -R $R --body "$comment" >/dev/null
gh pr merge "$pr" -R $R --squash --delete-branch >/dev/null
gh pr view "$pr" -R $R --json state -q .state
