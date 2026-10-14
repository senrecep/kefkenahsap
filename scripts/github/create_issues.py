# One-shot generator for the plan issues. Idempotent: keys already in issue_map.json are skipped, so re-running never duplicates.
import json, subprocess, sys, re, os
sys.path.insert(0, os.path.dirname(__file__))
from issues import EPICS, ISSUES, LABELS, MILESTONES

REPO = "senrecep/kefkenahsap"
DRY = "--dry" in sys.argv
STATE = os.path.join(os.path.dirname(__file__), "issue_map.json")

def gh(*args, input=None):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, input=input)
    if r.returncode != 0:
        raise SystemExit(f"gh {' '.join(args[:3])} failed: {r.stderr.strip()}")
    return r.stdout.strip()

# --- validation (self-check) ---
keys = {e["key"] for e in EPICS} | {i["key"] for i in ISSUES}
assert len(keys) == len(EPICS) + len(ISSUES), "duplicate keys"
for i in ISSUES:
    assert i["epic"] in {e["key"] for e in EPICS}, i["key"]
    for d in i.get("deps", []):
        assert d in keys, (i["key"], d)
    for l in i["labels"]:
        assert l in LABELS, (i["key"], l)
    for ref in re.findall(r"\{\{(\w[\w-]*)\}\}", i["body"]):
        assert ref in keys, (i["key"], ref)
print(f"valid: {len(EPICS)} epics, {len(ISSUES)} issues")
if DRY: sys.exit(0)

m = json.load(open(STATE)) if os.path.exists(STATE) else {}
def save(): json.dump(m, open(STATE, "w"), indent=1)

for name, color in LABELS.items():
    gh("label", "create", name, "-R", REPO, "--color", color, "--force")
existing = json.loads(gh("api", f"repos/{REPO}/milestones?state=all"))
have = {x["title"] for x in existing}
for t in MILESTONES:
    if t not in have:
        gh("api", "-X", "POST", f"repos/{REPO}/milestones", "-f", f"title={t}")

ms_of_phase = {"phase:F0": "F0 Spike", "phase:F1": "F1 Lansman", "phase:F2": "F2 İçerik & AI", "phase:F3": "F3 Genişleme"}
def create(key, title, body, labels, ms):
    if key in m: return
    url = gh("issue", "create", "-R", REPO, "--title", title, "--body", body,
             "--label", ",".join(labels), "--milestone", ms)
    num = int(url.rsplit("/", 1)[1])
    iid = json.loads(gh("api", f"repos/{REPO}/issues/{num}"))["id"]
    m[key] = {"num": num, "id": iid}; save(); print(key, num)

for e in EPICS:
    create(e["key"], e["title"], e["body"], e["labels"], e["ms"])
for i in ISSUES:
    ms = ms_of_phase[[l for l in i["labels"] if l.startswith("phase:")][0]]
    create(i["key"], i["title"], i["body"], i["labels"], ms)

def sub(s): return re.sub(r"\{\{(\w[\w-]*)\}\}", lambda x: f"#{m[x.group(1)]['num']}", s)

# second pass: final bodies with resolved refs, epic link, deps
for i in ISSUES:
    epic = next(e for e in EPICS if e["key"] == i["epic"])
    deps = ", ".join(f"#{m[d]['num']}" for d in i.get("deps", [])) or "—"
    body = sub(i["body"]) + f"\n\n---\n**Epic**: #{m[i['epic']]['num']} · **Bağımlılıklar**: {deps} · **Ultragoal**: `{epic['goal']}`\n**Akış**: branch `{'feat' if 'type:feature' in i['labels'] else i['labels'][1].split(':')[1]}/{m[i['key']]['num']}-…` → worktree → PR (`Closes #{m[i['key']]['num']}`) → `development`"
    gh("issue", "edit", str(m[i["key"]]["num"]), "-R", REPO, "--body", body)
for e in EPICS:
    children = [i for i in ISSUES if i["epic"] == e["key"]]
    lst = "\n".join(f"- [ ] #{m[c['key']]['num']} {c['title']}" for c in children)
    body = sub(e["body"]) + f"\n\n**Alt işler (sırayla)**\n{lst}\n\n---\n**Ultragoal**: `{e['goal']}` · Plan: `docs/PLAN.md`"
    gh("issue", "edit", str(m[e["key"]]["num"]), "-R", REPO, "--body", body)
    for c in children:
        r = subprocess.run(["gh", "api", "-X", "POST", f"repos/{REPO}/issues/{m[e['key']]['num']}/sub_issues",
                            "-F", f"sub_issue_id={m[c['key']]['id']}"], capture_output=True, text=True)
        if r.returncode != 0 and "already" not in r.stderr.lower() and "duplicate" not in r.stderr.lower():
            print("sub-issue link failed", c["key"], r.stderr.strip()[:200])
print("done")
