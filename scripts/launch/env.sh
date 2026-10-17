# Sourced (bash) at the top of every docs/LAUNCH.md block, which may run in a fresh shell:
#   . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
# That path is the launch worktree (LAUNCH step 1.0): detached at the release commit, deps installed, no .env.
# Names and helpers only, never secret values. Secrets are loaded inside a ( subshell ) with loadenv/r2env, so they
# die with it.
W=${W:-$HOME/Documents/projects/senrecep/kefkenahsap-workspace}   # holds .dokploy-{dev,prod}.env and the repo
L=$W/kefkenahsap-wt/launch                                         # launch worktree: scripts, maps, legacy data
P=compose-reboot-haptic-feed-t5r4ra                                # prod compose appName (id e9_MpMOeFkF1QLwEItoeq)
D=compose-hack-multi-byte-system-ysiihc                            # dev compose appName (id 4bzOPqDN2wxfKo-57uaGV)
SERVER_IP=45.196.28.107
# One local port per tunnel, so a forgotten tunnel can never point a command at the wrong DB.
PROD_PG_PORT=15432 PROD_APP_PORT=13000 DEV_PG_PORT=25432

loadenv() { set -a; . "$1"; set +a; }

# rclone remote "r2" from the prod app's media key (server-side copies inside the bucket).
r2env() {
  loadenv "$W/.dokploy-prod.env"
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_ENDPOINT="$S3_ENDPOINT" \
    RCLONE_CONFIG_R2_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
}

# pgurl <local port>: URL of a tunnelled kefken DB. POSTGRES_PASSWORD (from loadenv) is URL-encoded, read from the env.
pgurl() {
  local pw
  pw=$(python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["POSTGRES_PASSWORD"], safe=""))') || return 1
  echo "postgres://kefken:$pw@127.0.0.1:$1/kefken"
}

# tunnel_open <name> <local port> <container> <container port>: background SSH forward with a control socket.
# Fails (instead of silently reusing someone else's port) when the local port is taken.
tunnel_open() {
  local ip
  ssh -S "${XDG_RUNTIME_DIR:-/tmp}/kefken-$1.sock" -O check senrecep 2>/dev/null && return 0   # already open
  ip=$(ssh senrecep "docker inspect $3 -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'" | awk '{print $1}')
  [ -n "$ip" ] || { echo "tunnel_open: no IP for $3" >&2; return 1; }
  ssh -f -N -M -S "${XDG_RUNTIME_DIR:-/tmp}/kefken-$1.sock" -o ExitOnForwardFailure=yes -L "127.0.0.1:$2:$ip:$4" senrecep
}
tunnel_close() { ssh -S "${XDG_RUNTIME_DIR:-/tmp}/kefken-$1.sock" -O exit senrecep 2>/dev/null || true; }

# need <file> <min lines>: fail closed when a listing came back empty or short.
need() { local n; n=$(wc -l < "$1"); [ "$n" -ge "$2" ] || { echo "need: $1 has $n lines, expected >= $2" >&2; return 1; }; }

