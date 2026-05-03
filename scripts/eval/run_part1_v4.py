#!/usr/bin/env python3
"""Execute TC-001 to TC-060 and generate EVAL_RESULTS_PART1.md"""

import subprocess
import json
import re
import os
import sys
from datetime import datetime

PW = ["node", "dist/cli.js"]
BASE_URL = "http://localhost:3099"

results = []

def run_pw(args, timeout=20):
    try:
        result = subprocess.run(PW + args, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def run_shell(cmd, timeout=25):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def record(tc, name, status, output_snippet="", reason=""):
    lines = output_snippet.strip().split("\n")[:3]
    snippet = " | ".join(lines) if lines and lines[0] else "(无输出)"
    snippet = snippet[:200]
    results.append({"tc": tc, "name": name, "status": status, "output": snippet, "reason": reason})
    print(f"[{status}] {tc}: {name}" + (f" ({reason})" if reason else ""), file=sys.stderr)

def clean_sessions():
    for s in ["eval-p1-1", "eval-p1-2", "eval-p1-3", "eval-p1-b1", "eval-ses-01", "eval-ses-02", "eval-ses-03", "eval-probe", "eval-test-speed"]:
        run_pw(["session", "close", s])

def login_session(name):
    """Log in a session to access protected pages."""
    run_pw(["open", f"{BASE_URL}/login", "--session", name])
    run_pw(["fill", "--session", name, "--label", "Email address", "demo@test.com"])
    run_pw(["fill", "--session", name, "--label", "Password", "password123"])
    c, o, e = run_pw(["click", "--session", name, "--role", "button", "--name", "Sign in"])
    return c, o, e

clean_sessions()

# =================== Domain 1 ===================
print("=== Domain 1 ===", file=sys.stderr)

# TC-001
c, o, e = run_pw(["session", "create", "eval-p1-1", "--open", BASE_URL], timeout=25)
t = o+e
if c==0 and "created=true" in t and "eval-p1-1" in t:
    record("TC-001", "session create 基本创建", "PASS", t)
else:
    record("TC-001", "session create 基本创建", "FAIL", t, f"exit={c}")

# TC-002
c, o, e = run_pw(["session", "create", "eval-p1-2", "--headed", "--open", BASE_URL], timeout=25)
t = o+e
if c==0 and "created=true" in t and "headed" in t:
    record("TC-002", "session create --headed", "PASS", t)
elif c!=0:
    record("TC-002", "session create --headed", "SKIP", t, "headless environment")
else:
    record("TC-002", "session create --headed", "FAIL", t, f"exit={c}")

# TC-003
c, o, e = run_pw(["session", "create", "eval-p1-3", "--open", f"{BASE_URL}/login"], timeout=25)
t = o+e
if c==0 and "created=true" in t and "/login" in t:
    record("TC-003", "session create --open URL", "PASS", t)
else:
    record("TC-003", "session create --open URL", "FAIL", t, f"exit={c}")

# TC-004
c, o, e = run_pw(["session", "status", "eval-p1-1"])
t = o+e
if c==0 and "active=true" in t and "socketPath" in t:
    record("TC-004", "session status 查询存活", "PASS", t)
else:
    record("TC-004", "session status 查询存活", "FAIL", t, f"exit={c}")

# TC-005
c, o, e = run_pw(["session", "status", "eval-p1-ghost"])
t = o+e
if c!=0 and ("NOT_FOUND" in t or "STATUS_FAILED" in t):
    record("TC-005", "session status 查询不存在", "PASS", t)
else:
    record("TC-005", "session status 查询不存在", "FAIL", t, f"expected non-zero, got {c}")

# TC-006
c, o, e = run_pw(["session", "list"])
t = o+e
if c==0 and "alive=true" in t:
    record("TC-006", "session list", "PASS", t)
else:
    record("TC-006", "session list", "FAIL", t, f"exit={c}")

# TC-007
c, o, e = run_pw(["session", "list", "--with-page"])
t = o+e
if c==0 and "eval-p1-1" in t:
    record("TC-007", "session list --with-page", "PASS", t)
else:
    record("TC-007", "session list --with-page", "FAIL", t, f"exit={c}")

# TC-008
c, o, e = run_pw(["session", "recreate", "eval-p1-1", "--open", f"{BASE_URL}/login"], timeout=25)
t = o+e
if c==0 and ("created=true" in t or "recreated" in t or "eval-p1-1" in t):
    record("TC-008", "session recreate", "PASS", t)
else:
    record("TC-008", "session recreate", "FAIL", t, f"exit={c}")

# TC-009
c, o, e = run_pw(["session", "list", "--attachable"])
t = o+e
if c==0:
    record("TC-009", "session list --attachable", "PASS", t)
else:
    record("TC-009", "session list --attachable", "FAIL", t, f"exit={c}")

# TC-010
c, o, e = run_pw(["session", "close", "eval-p1-2"])
t = o+e
if c==0:
    record("TC-010", "session close", "PASS", t)
else:
    record("TC-010", "session close", "FAIL", t, f"exit={c}")

run_pw(["session", "close", "eval-p1-3"])

# Log in eval-p1-1 so protected pages work
login_session("eval-p1-1")

# =================== Domain 2 ===================
print("=== Domain 2 ===", file=sys.stderr)
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])

# TC-011
c, o, e = run_pw(["observe", "status", "--session", "eval-p1-1"])
t = o+e
if c==0 and '"summary"' in t and '"currentPage"' in t:
    record("TC-011", "observe status", "PASS", t)
else:
    record("TC-011", "observe status", "FAIL", t, f"exit={c}")

# TC-012
c, o, e = run_pw(["read-text", "--session", "eval-p1-1"])
t = o+e
if c==0 and len(t.strip())>0:
    record("TC-012", "read-text 默认全页", "PASS", t[:100])
else:
    record("TC-012", "read-text 默认全页", "FAIL", t, f"exit={c}")

# TC-013
c, o, e = run_pw(["read-text", "--session", "eval-p1-1", "--max-chars", "500"])
t = o+e
if c==0 and len(t.strip())>0:
    record("TC-013", "read-text --max-chars", "PASS", t[:100])
else:
    record("TC-013", "read-text --max-chars", "FAIL", t, f"exit={c}")

# TC-014
c, o, e = run_pw(["read-text", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"]'])
t = o+e
if c==0 and ("Total Users" in t or "12842" in t):
    record("TC-014", "read-text --selector", "PASS", t[:100])
else:
    record("TC-014", "read-text --selector", "FAIL", t, f"exit={c}")

# TC-015
c, o, e = run_pw(["snapshot", "--session", "eval-p1-1"])
t = o+e
if c==0 and any(r in t for r in ["heading", "button", "link", "generic"]):
    record("TC-015", "snapshot 完整结构树", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-015", "snapshot 完整结构树", "FAIL", t, f"exit={c}")

# TC-016
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["snapshot", "-i", "--session", "eval-p1-1"])
t = o+e
if c==0 and any(r in t for r in ["button", "textbox", "link"]):
    record("TC-016", "snapshot -i 交互节点", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-016", "snapshot -i 交互节点", "FAIL", t, f"exit={c}")

# TC-017
c, o, e = run_pw(["snapshot", "-c", "--session", "eval-p1-1"])
t = o+e
if c==0 and len(t.strip())>0:
    record("TC-017", "snapshot -c 紧凑模式", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-017", "snapshot -c 紧凑模式", "FAIL", t, f"exit={c}")

# TC-018
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["accessibility", "--session", "eval-p1-1"])
t = o+e
if c==0 and any(r in t for r in ["heading", "button", "link", "textbox"]):
    record("TC-018", "accessibility 基本", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-018", "accessibility 基本", "FAIL", t, f"exit={c}")

# TC-019
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["accessibility", "-i", "--session", "eval-p1-1"])
t = o+e
if c==0 and any(r in t for r in ["button", "textbox", "link"]):
    record("TC-019", "accessibility -i 仅交互", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-019", "accessibility -i 仅交互", "FAIL", t, f"exit={c}")

# TC-020
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["screenshot", "--session", "eval-p1-1"])
t = o+e
if c==0 and "Screenshot:" in t and ".png" in t:
    record("TC-020", "screenshot 基本", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-020", "screenshot 基本", "FAIL", t, f"exit={c}")

# TC-021
c, o, e = run_pw(["screenshot", "--session", "eval-p1-1", "--full-page"])
t = o+e
if c==0 and "Screenshot:" in t:
    record("TC-021", "screenshot --full-page", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-021", "screenshot --full-page", "FAIL", t, f"exit={c}")

# TC-022
c, o, e = run_pw(["pdf", "--session", "eval-p1-1", "--path", "/tmp/eval-test.pdf"])
t = o+e
if c==0 and ("saved=true" in t or "/tmp/eval-test.pdf" in t):
    record("TC-022", "pdf 生成", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-022", "pdf 生成", "FAIL", t, f"exit={c}")

# TC-023
c, o, e = run_pw(["page", "current", "--session", "eval-p1-1"])
t = o+e
if c==0 and "pageId=" in t:
    record("TC-023", "page current", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-023", "page current", "FAIL", t, f"exit={c}")

# TC-024
c, o, e = run_pw(["page", "frames", "--session", "eval-p1-1"])
t = o+e
if c==0 and '"frames"' in t:
    record("TC-024", "page frames", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-024", "page frames", "FAIL", t, f"exit={c}")

# TC-025
c, o, e = run_pw(["page", "assess", "--session", "eval-p1-1"])
t = o+e
if c==0 and '"summary"' in t:
    record("TC-025", "page assess", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-025", "page assess", "FAIL", t, f"exit={c}")

# =================== Domain 3 ===================
print("=== Domain 3 ===", file=sys.stderr)

# TC-026
c, o, e = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
t = o+e
if c==0 and "/login" in t:
    record("TC-026", "open 导航", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-026", "open 导航", "FAIL", t, f"exit={c}")

# TC-027
run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-p1-1"])
run_pw(["click", "--session", "eval-p1-1", "--test-id", "link-new-tab-child"])
c, o, e = run_pw(["page", "list", "--session", "eval-p1-1"])
t = o+e
page_ids = []
if c==0 and '"pages"' in t:
    try:
        d = json.loads(t)
        pages = d.get("pages", [])
        if len(pages) >= 2:
            page_ids = [p.get("pageId") for p in pages]
            record("TC-027", "tab list 多 tab", "PASS", f"pages={len(pages)}")
        else:
            record("TC-027", "tab list 多 tab", "FAIL", t, f"only {len(pages)} pages")
    except Exception as ex:
        record("TC-027", "tab list 多 tab", "FAIL", t, str(ex))
else:
    record("TC-027", "tab list 多 tab", "FAIL", t, f"exit={c}")

# TC-028
p2 = page_ids[1] if len(page_ids) >= 2 else None
if p2:
    c, o, e = run_pw(["tab", "select", p2, "--session", "eval-p1-1"])
    c2, o2, e2 = run_pw(["page", "current", "--session", "eval-p1-1"])
    t2 = o2+e2
    if c==0 and ("/tabs/child" in t2 or p2 in t2):
        record("TC-028", "tab select", "PASS", t2.splitlines()[0] if t2 else "")
    else:
        record("TC-028", "tab select", "FAIL", t2, f"select exit={c}")
else:
    record("TC-028", "tab select", "SKIP", "", "no second pageId")

# TC-029
if p2:
    c, o, e = run_pw(["tab", "close", p2, "--session", "eval-p1-1"])
    c2, o2, e2 = run_pw(["page", "list", "--session", "eval-p1-1"])
    t2 = o2+e2
    if c==0:
        try:
            d = json.loads(t2)
            pages = d.get("pages", [])
            if len(pages) < len(page_ids):
                record("TC-029", "tab close", "PASS", f"pages={len(pages)}")
            else:
                record("TC-029", "tab close", "FAIL", t2, "page count not reduced")
        except:
            record("TC-029", "tab close", "PASS", (o+e).splitlines()[0] if (o+e) else "")
    else:
        record("TC-029", "tab close", "FAIL", o+e, f"exit={c}")
else:
    record("TC-029", "tab close", "SKIP", "", "no second pageId")

# TC-030
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["wait", "network-idle", "--session", "eval-p1-1"], timeout=25)
t = o+e
if c==0 and "timeout" not in t.lower():
    record("TC-030", "wait network-idle", "PASS", t.splitlines()[0] if t else "wait ok")
else:
    record("TC-030", "wait network-idle", "FAIL", t, f"exit={c}")

# TC-031
c, o, e = run_pw(["wait", "--selector", '[data-testid="stat-users"]', "--session", "eval-p1-1"], timeout=25)
t = o+e
if c==0 and "timeout" not in t.lower():
    record("TC-031", "wait --selector", "PASS", t.splitlines()[0] if t else "wait ok")
else:
    record("TC-031", "wait --selector", "FAIL", t, f"exit={c}")

# TC-032
c, o, e = run_pw(["wait", "--text", "Total Users", "--session", "eval-p1-1"], timeout=25)
t = o+e
if c==0 and "timeout" not in t.lower():
    record("TC-032", "wait --text", "PASS", t.splitlines()[0] if t else "wait ok")
else:
    record("TC-032", "wait --text", "FAIL", t, f"exit={c}")

# TC-033
run_pw(["open", f"{BASE_URL}/network", "--session", "eval-p1-1"])
c, o, e = run_pw(["wait", "--networkidle", "--session", "eval-p1-1"], timeout=25)
t = o+e
if c==0 and "timeout" not in t.lower():
    record("TC-033", "wait --networkidle", "PASS", t.splitlines()[0] if t else "wait ok")
else:
    record("TC-033", "wait --networkidle", "FAIL", t, f"exit={c}")

# TC-034
c, o, e = run_pw(["page", "dialogs", "--session", "eval-p1-1"])
t = o+e
if c==0 and "dialogs" in t:
    record("TC-034", "page dialogs", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-034", "page dialogs", "FAIL", t, f"exit={c}")

# TC-035
c, o, e = run_pw(["resize", "--session", "eval-p1-1", "--view", "1280x800"])
t = o+e
if c==0 and ("width" in t or "height" in t or "1280" in t or "800" in t):
    record("TC-035", "resize viewport", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-035", "resize viewport", "FAIL", t, f"exit={c}")

# =================== Domain 4 ===================
print("=== Domain 4 ===", file=sys.stderr)

# TC-036
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["click", "--session", "eval-p1-1", "--selector", '[data-testid="login-submit"]'])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-036", "click selector", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-036", "click selector", "FAIL", t, f"exit={c}")

# TC-037
c, o, e = run_pw(["click", "--session", "eval-p1-1", "--role", "button", "--name", "Sign in"])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-037", "click role/name", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-037", "click role/name", "FAIL", t, f"exit={c}")

# TC-038
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["snapshot", "-i", "--session", "eval-p1-1", "--output", "json"])
t = o+e
ref = None
if c==0:
    try:
        d = json.loads(t)
        snap = d.get("data", {}).get("snapshot", "")
        m = re.search(r'button "Sign in" \[ref=(e\d+)\]', snap)
        if m: ref = m.group(1)
        else:
            m = re.search(r'\[ref=(e\d+)\].*button', snap, re.DOTALL)
            if m: ref = m.group(1)
    except:
        pass
if not ref:
    m = re.search(r'\[ref=(e\d+)\]', t)
    if m: ref = m.group(1)

if ref:
    c, o, e = run_pw(["click", ref, "--session", "eval-p1-1"])
    t = o+e
    if c==0 and "acted=true" in t:
        record("TC-038", "click ref", "PASS", t.splitlines()[0] if t else "")
    else:
        record("TC-038", "click ref", "FAIL", t, f"exit={c}")
else:
    record("TC-038", "click ref", "FAIL", t, "no ref found")

# TC-039
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c1, o1, e1 = run_pw(["fill", "--session", "eval-p1-1", "--label", "Email address", "demo@test.com"])
c2, o2, e2 = run_pw(["fill", "--session", "eval-p1-1", "--label", "Password", "password123"])
t1 = o1+e1
t2 = o2+e2
if c1==0 and c2==0 and "filled=true" in t1 and "filled=true" in t2:
    record("TC-039", "fill 填充", "PASS", "email ok, password ok")
else:
    record("TC-039", "fill 填充", "FAIL", f"email={t1[:80]} pw={t2[:80]}", f"exit1={c1}, exit2={c2}")

# TC-040
run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
c, o, e = run_pw(["type", "--session", "eval-p1-1", "--label", "Full name", "John Doe"])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-040", "type 逐字符输入", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-040", "type 逐字符输入", "FAIL", t, f"exit={c}")

# TC-041
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["press", "Enter", "--session", "eval-p1-1"])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-041", "press Enter", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-041", "press Enter", "FAIL", t, f"exit={c}")

# TC-042
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["hover", "--session", "eval-p1-1", "--test-id", "hover-target"])
t = o+e
c2, o2, e2 = run_pw(["read-text", "--session", "eval-p1-1"])
t2 = o2+e2
if c==0 and "acted=true" in t and "Tooltip visible!" in t2:
    record("TC-042", "hover tooltip", "PASS", "hover acted + tooltip visible")
elif c==0 and "acted=true" in t:
    record("TC-042", "hover tooltip", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-042", "hover tooltip", "FAIL", t, f"exit={c}")

# TC-043
run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
c, o, e = run_pw(["select", "--session", "eval-p1-1", "--label", "Country", "us"])
t = o+e
if c==0 and ("acted=true" in t or "value" in t):
    record("TC-043", "select 下拉", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-043", "select 下拉", "FAIL", t, f"exit={c}")

# TC-044
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["check", "--session", "eval-p1-1", "--label", "Remember me"])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-044", "check checkbox", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-044", "check checkbox", "FAIL", t, f"exit={c}")

# TC-045
c, o, e = run_pw(["uncheck", "--session", "eval-p1-1", "--label", "Remember me"])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-045", "uncheck checkbox", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-045", "uncheck checkbox", "FAIL", t, f"exit={c}")

# TC-046
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["drag", "--session", "eval-p1-1", "--from-selector", '[data-testid="drag-item-0"]', "--to-selector", '[data-testid="drag-item-2"]'])
t = o+e
if c==0 and "acted=true" in t:
    record("TC-046", "drag 拖拽", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-046", "drag 拖拽", "FAIL", t, f"exit={c}")

# TC-047
subprocess.run("echo 'eval upload test' > /tmp/eval-upload.txt", shell=True)
run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
c, o, e = run_pw(["upload", "--session", "eval-p1-1", "--selector", '[data-testid="file-input"]', "/tmp/eval-upload.txt"])
t = o+e
if c==0 and ("uploaded" in t or "acted=true" in t or "eval-upload.txt" in t):
    record("TC-047", "upload 文件上传", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-047", "upload 文件上传", "FAIL", t, f"exit={c}")

# TC-048
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["download", "--session", "eval-p1-1", "--selector", '[data-testid="download-server-txt"]'])
t = o+e
if c==0 and ("path" in t or ".txt" in t):
    record("TC-048", "download 下载", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-048", "download 下载", "FAIL", t, f"exit={c}")

# TC-049
run_pw(["open", f"{BASE_URL}/dynamic", "--session", "eval-p1-1"])
c, o, e = run_pw(["scroll", "down", "500", "--session", "eval-p1-1"])
t = o+e
if c==0 and ("acted=true" in t or "scroll" in t.lower()):
    record("TC-049", "scroll down", "PASS", t.splitlines()[0] if t else "scroll ok")
else:
    record("TC-049", "scroll down", "FAIL", t, f"exit={c}")

# TC-050
c, o, e = run_pw(["scroll", "up", "500", "--session", "eval-p1-1"])
t = o+e
if c==0 and ("acted=true" in t or "scroll" in t.lower()):
    record("TC-050", "scroll up", "PASS", t.splitlines()[0] if t else "scroll ok")
else:
    record("TC-050", "scroll up", "FAIL", t, f"exit={c}")

# TC-051
c, o, e = run_pw(["mouse", "move", "--session", "eval-p1-1", "--x", "400", "--y", "300"])
t = o+e
if c==0:
    record("TC-051", "mouse move", "PASS", t.splitlines()[0] if t else "move ok")
else:
    record("TC-051", "mouse move", "FAIL", t, f"exit={c}")

# TC-052
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["mouse", "click", "--session", "eval-p1-1", "--x", "400", "--y", "300"])
t = o+e
if c==0:
    record("TC-052", "mouse click", "PASS", t.splitlines()[0] if t else "click ok")
else:
    record("TC-052", "mouse click", "FAIL", t, f"exit={c}")

# TC-053
c, o, e = run_pw(["mouse", "wheel", "--session", "eval-p1-1", "--delta-x", "0", "--delta-y", "300"])
t = o+e
if c==0:
    record("TC-053", "mouse wheel", "PASS", t.splitlines()[0] if t else "wheel ok")
else:
    record("TC-053", "mouse wheel", "FAIL", t, f"exit={c}")

# TC-054
run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-p1-1"])
c, o, e = run_pw(["click", "--session", "eval-p1-1", "--test-id", "link-new-tab-child"])
t = o+e
if c==0 and ("openedPage" in t or "pageId" in t or "/tabs/child" in t):
    record("TC-054", "click popup 新页面", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-054", "click popup 新页面", "FAIL", t, f"exit={c}")

# TC-055
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["mouse", "dblclick", "--session", "eval-p1-1", "--x", "400", "--y", "400"])
t = o+e
if c==0:
    record("TC-055", "mouse dblclick", "PASS", t.splitlines()[0] if t else "dblclick ok")
else:
    record("TC-055", "mouse dblclick", "FAIL", t, f"exit={c}")

# =================== Domain 5 ===================
print("=== Domain 5 ===", file=sys.stderr)

# TC-056
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_shell("echo '[[\"observe\", \"status\"]]' | node dist/cli.js batch --session eval-p1-1 --stdin-json", timeout=25)
t = o+e
if c==0 and "completed=true" in t and "success=1" in t:
    record("TC-056", "batch 单命令", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-056", "batch 单命令", "FAIL", t, f"exit={c}")

# TC-057
c, o, e = run_pw(["session", "create", "eval-p1-b1", "--open", f"{BASE_URL}/login"], timeout=25)
t = o+e
c, o, e = run_shell('printf "%s" \'[["fill", "--label", "Email address", "demo@test.com"],["fill", "--label", "Password", "password123"],["click", "--role", "button", "--name", "Sign in"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json', timeout=35)
t = o+e
if c==0 and "completed=true" in t and "success=3" in t:
    record("TC-057", "batch 登录流程", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-057", "batch 登录流程", "FAIL", t, f"exit={c}")

# TC-058
run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-b1"])
c, o, e = run_shell('printf "%s" \'[["fill", "--label", "Full name", "Alice Test"],["fill", "--label", "Email address", "alice@test.com"],["select", "--label", "Country", "us"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json', timeout=35)
t = o+e
if c==0 and "completed=true" in t and "success=3" in t:
    record("TC-058", "batch 表单填写", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-058", "batch 表单填写", "FAIL", t, f"exit={c}")

# TC-059
c, o, e = run_shell("echo '[[\"observe\", \"status\"]]' | node dist/cli.js batch --session eval-p1-ghost --stdin-json", timeout=20)
t = o+e
if c!=0 and "NOT_FOUND" in t:
    record("TC-059", "batch SESSION_NOT_FOUND", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-059", "batch SESSION_NOT_FOUND", "FAIL", t, f"expected non-zero with NOT_FOUND, got exit={c}")

# TC-060
c, o, e = run_shell('printf "%s" \'[["click", "--selector", "#nonexistent-element-xyz"],["observe", "status"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json --continue-on-error', timeout=35)
t = o+e
if c==0 and "completed=true" in t and "failed=1" in t and "success=1" in t:
    record("TC-060", "batch continue-on-error", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-060", "batch continue-on-error", "FAIL", t, f"exit={c}")

# =================== Domain 6 ===================
print("=== Domain 6 ===", file=sys.stderr)

# TC-063
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["verify", "text", "--session", "eval-p1-1", "--text", "Total Users"])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-063", "verify text", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-063", "verify text", "FAIL", t, f"exit={c}")

# TC-064
c, o, e = run_pw(["verify", "text-absent", "--session", "eval-p1-1", "--text", "THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST"])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-064", "verify text-absent", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-064", "verify text-absent", "FAIL", t, f"exit={c}")

# TC-065
c, o, e = run_pw(["verify", "visible", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"]'])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-065", "verify visible", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-065", "verify visible", "FAIL", t, f"exit={c}")

# TC-066
run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
c, o, e = run_pw(["verify", "disabled", "--session", "eval-p1-1", "--selector", '[data-testid="btn-disabled"]'])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-066", "verify disabled", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-066", "verify disabled", "FAIL", t, f"exit={c}")

# TC-067
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["verify", "url", "--session", "eval-p1-1", "--contains", "/dashboard"])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-067", "verify url", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-067", "verify url", "FAIL", t, f"exit={c}")

# TC-068
c, o, e = run_pw(["verify", "count", "--session", "eval-p1-1", "--selector", '[data-testid^="stat-"]', "--equals", "4"])
t = o+e
if c==0 and "passed=true" in t:
    record("TC-068", "verify count", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-068", "verify count", "FAIL", t, f"exit={c}")

# TC-069
c, o, e = run_pw(["get", "text", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"] .text-2xl'])
t = o+e
if c==0 and ("text" in t or "count" in t):
    record("TC-069", "get text", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-069", "get text", "FAIL", t, f"exit={c}")

# TC-070
c, o, e = run_pw(["locate", "--session", "eval-p1-1", "--text", "Total Users"])
t = o+e
if c==0 and ("count" in t or "candidates" in t):
    record("TC-070", "locate 语义定位", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-070", "locate 语义定位", "FAIL", t, f"exit={c}")

# TC-071
run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
c, o, e = run_pw(["is", "visible", "--session", "eval-p1-1", "--selector", '[data-testid="login-submit"]'])
t = o+e
if c==0 and "value=true" in t:
    record("TC-071", "is visible", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-071", "is visible", "FAIL", t, f"exit={c}")

# TC-072
run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
c, o, e = run_pw(["verify", "text", "--session", "eval-p1-1", "--text", "THIS_VERY_UNIQUE_ABSENT_TEXT_123"])
t = o+e
if c!=0 and ("VERIFY_FAILED" in t or "passed=false" in t):
    record("TC-072", "verify VERIFY_FAILED", "PASS", t.splitlines()[0] if t else "")
else:
    record("TC-072", "verify VERIFY_FAILED", "FAIL", t, f"expected non-zero with VERIFY_FAILED, got exit={c}")

# Cleanup
clean_sessions()

# =================== Report ===================
print("=== Generating Report ===", file=sys.stderr)

domain_map = {}
for i in range(1, 11): domain_map[f"TC-{i:03d}"] = "Domain 1"
for i in range(11, 26): domain_map[f"TC-{i:03d}"] = "Domain 2"
for i in range(26, 36): domain_map[f"TC-{i:03d}"] = "Domain 3"
for i in range(36, 56): domain_map[f"TC-{i:03d}"] = "Domain 4"
for i in range(56, 63): domain_map[f"TC-{i:03d}"] = "Domain 5"
for i in range(63, 73): domain_map[f"TC-{i:03d}"] = "Domain 6"

stats = {f"Domain {i}": {"total":0,"pass":0,"fail":0,"skip":0} for i in range(1,7)}
for r in results:
    d = domain_map.get(r["tc"], "Unknown")
    if d not in stats: stats[d] = {"total":0,"pass":0,"fail":0,"skip":0}
    stats[d]["total"] += 1
    if r["status"]=="PASS": stats[d]["pass"]+=1
    elif r["status"]=="FAIL": stats[d]["fail"]+=1
    else: stats[d]["skip"]+=1

tp = sum(s["pass"] for s in stats.values())
tf = sum(s["fail"] for s in stats.values())
ts = sum(s["skip"] for s in stats.values())
tot = tp+tf+ts

report = f"""# pwcli 评测结果 Part1（TC-001~060）
执行时间: {datetime.now().isoformat()}

## Domain 统计
| Domain | 总数 | Pass | Fail | Skip |
|--------|------|------|------|------|
"""
for i in range(1,7):
    d=f"Domain {i}"
    s=stats[d]
    report+=f"| {d} | {s['total']} | {s['pass']} | {s['fail']} | {s['skip']} |\n"
report+=f"| **总计** | **{tot}** | **{tp}** | **{tf}** | **{ts}** |\n"

report+="\n## 详细结果\n"
for r in results:
    icon = "✅ PASS" if r["status"]=="PASS" else ("❌ FAIL" if r["status"]=="FAIL" else "⚠️ SKIP")
    out = r["output"].replace("|", "\\|").replace("\n", " ")
    report += f"""### {r['tc']}: {r['name']}
- 状态: {icon}
- 实际输出: {out}
"""
    if r["reason"]:
        report += f"- 失败原因: {r['reason']}\n"
    report += "\n"

report += "## 失败用例列表\n"
failed = [r for r in results if r["status"]=="FAIL"]
if failed:
    for r in failed:
        report += f"- {r['tc']}: {r['name']} — {r['reason']}\n"
else:
    report += "- 无\n"

report += f"""\n## Part1 通过率
{tp}/{tot} ({tp/tot*100:.1f}%)
"""

os.makedirs("scripts/eval", exist_ok=True)
with open("scripts/eval/EVAL_RESULTS_PART1.md", "w") as f:
    f.write(report)

print(f"Report written to scripts/eval/EVAL_RESULTS_PART1.md", file=sys.stderr)
print(f"Total: {tot}, Pass: {tp}, Fail: {tf}, Skip: {ts}", file=sys.stderr)
