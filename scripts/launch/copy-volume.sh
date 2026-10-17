#!/usr/bin/env bash
# Copy one Docker volume into another and prove it: every source file must exist in the target with the same
# SHA-256 (generic; no longer used by docs/LAUNCH.md since #204). Never deletes. Run ON the server:
#   ssh senrecep bash -s -- <source volume> <target volume> < scripts/launch/copy-volume.sh
# Uses postgres:17-alpine (already on the server for the stacks) as a busybox shell; no image is pulled.
set -euo pipefail
src=${1:?source volume} dst=${2:?target volume}
case "$src$dst" in *lead-photos*) echo 'refusing: lead-photos (personal data) is never copied' >&2; exit 2 ;; esac
docker volume inspect "$src" "$dst" >/dev/null
docker run --rm --entrypoint sh -v "$src":/from:ro -v "$dst":/to postgres:17-alpine -c '
  set -e
  cd /from && find . -type f -exec sha256sum {} + | sort -k2 > /tmp/src.sum
  n=$(wc -l < /tmp/src.sum)
  cp -a /from/. /to/
  cd /to && sha256sum -c -s /tmp/src.sum || { echo "checksum mismatch in target" >&2; exit 1; }
  echo "copied and verified $n files; target now holds $(find /to -type f | wc -l)"
'
