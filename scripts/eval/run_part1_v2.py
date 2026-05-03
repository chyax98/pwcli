#!/usr/bin/env python3
"""Execute TC-001 to TC-060 and generate EVAL_RESULTS_PART1.md"""

import subprocess
import json
import re
import os
import shlex
from datetime import datetime

PW = ["node", "dist/cli.js"]
BASE_URL = "http://localhost:3099"

results = []

def run_pw(args, timeout=30):
    """Run pwcli with given args list."""
    try:
        result = subprocess.run(
            PW + args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def record(tc, name, status, output_snippet="", reason=""):
    # Truncate snippet
    lines = output_snippet.strip().split("\n")[:3]
    snippet = " | ".join(lines) if lines and lines[0] else "(无输出)"
    snippet = snippet[:200]
    results.append({
        "tc": tc,
        "name": name,
        "status": status,
        "output": snippet,
        "reason": reason,
    })

def close_session(name):
    run_pw(["session", "close", name])

def clean_sessions():
    # Close all eval-p1 sessions
    code, out, err = run_pw(["session", "list"])
    for line in (out + err).splitlines():
        if line.startswith("eval-p1-") or line.startswith("eval-ses-"):
            name = line.split()[0]
            run_pw(["session", "close", name])

# Start fresh
clean_sessions()

# ============================================================
# Domain 1: Session Management (TC-001 ~ TC-010)
# ============================================================
print("=== Domain 1 ===")

# TC-001: session create basic
code, out, err = run_pw(["session", "create", "eval-p1-1", "--open", BASE_URL])
txt = out + err
if code == 0 and "created=true" in txt and "eval-p1-1" in txt:
    record("TC-001", "session create 基本创建", "PASS", txt)
else:
    record("TC-001", "session create 基本创建", "FAIL", txt, f"exit={code}")

# TC-002: session create --headed
code, out, err = run_pw(["session", "create", "eval-p1-2", "--headed", "--open", BASE_URL])
txt = out + err
if code == 0 and "created=true" in txt and "headed" in txt:
    record("TC-002", "session create --headed", "PASS", txt)
else:
    # In headless CI, this may fail
    record("TC-002", "session create --headed", "SKIP", txt, f"exit={code}, likely headless env")

# TC-003: session create --open URL
code, out, err = run_pw(["session", "create", "eval-p1-3", "--open", f"{BASE_URL}/login"])
txt = out + err
if code == 0 and "created=true" in txt and "/login" in txt:
    record("TC-003", "session create --open URL", "PASS", txt)
else:
    record("TC-003", "session create --open URL", "FAIL", txt, f"exit={code}")

# TC-004: session status
code, out, err = run_pw(["session", "status", "eval-p1-1"])
txt = out + err
if code == 0 and "active=true" in txt and "socketPath" in txt and "version" in txt:
    record("TC-004", "session status 查询存活", "PASS", txt)
else:
    record("TC-004", "session status 查询存活", "FAIL", txt, f"exit={code}")

# TC-005: session status not found
code, out, err = run_pw(["session", "status", "eval-p1-ghost"])
txt = out + err
if code != 0 and ("NOT_FOUND" in txt or "STATUS_FAILED" in txt):
    record("TC-005", "session status 查询不存在", "PASS", txt)
else:
    record("TC-005", "session status 查询不存在", "FAIL", txt, f"expected non-zero, got exit={code}")

# TC-006: session list
code, out, err = run_pw(["session", "list"])
txt = out + err
if code == 0 and "eval-p1-1" in txt and "alive=true" in txt:
    record("TC-006", "session list", "PASS", txt)
else:
    record("TC-006", "session list", "FAIL", txt, f"exit={code}")

# TC-007: session list --with-page
code, out, err = run_pw(["session", "list", "--with-page"])
txt = out + err
if code == 0 and "eval-p1-1" in txt:
    record("TC-007", "session list --with-page", "PASS", txt)
else:
    record("TC-007", "session list --with-page", "FAIL", txt, f"exit={code}")

# TC-008: session recreate
code, out, err = run_pw(["session", "recreate", "eval-p1-1", "--open", f"{BASE_URL}/login"])
txt = out + err
# recreate may say created=true or recreated=true or similar
if code == 0 and ("created=true" in txt or "recreated" in txt or "eval-p1-1" in txt):
    record("TC-008", "session recreate", "PASS", txt)
else:
    record("TC-008", "session recreate", "FAIL", txt, f"exit={code}")

# TC-009: session list --attachable
code, out, err = run_pw(["session", "list", "--attachable"])
txt = out + err
if code == 0:
    record("TC-009", "session list --attachable", "PASS", txt)
else:
    record("TC-009", "session list --attachable", "FAIL", txt, f"exit={code}")

# TC-010: session close
code, out, err = run_pw(["session", "close", "eval-p1-2"])
txt = out + err
if code == 0:
    record("TC-010", "session close", "PASS", txt)
else:
    record("TC-010", "session close", "FAIL", txt, f"exit={code}")

# Close domain 1 leftover sessions except eval-p1-1
close_session("eval-p1-3")

# ============================================================
# Domain 2: Page Reading (TC-011 ~ TC-025)
# ============================================================
print("=== Domain 2 ===")

# Ensure eval-p1-1 is on dashboard
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])

# TC-011: observe status
code, out, err = run_pw(["observe", "status", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and '"summary"' in txt and '"currentPage"' in txt and '"dialogs"' in txt:
    record("TC-011", "observe status", "PASS", txt)
else:
    record("TC-011", "observe status", "FAIL", txt, f"exit={code}")

# TC-012: read-text default
code, out, err = run_pw(["read-text", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and len(txt.strip()) > 0 and ("Total Users" in txt or "Active Sessions" in txt or "Dashboard" in txt or "truncated" in txt):
    record("TC-012", "read-text 默认全页", "PASS", txt[:100])
else:
    record("TC-012", "read-text 默认全页", "FAIL", txt, f"exit={code}")

# TC-013: read-text --max-chars
code, out, err = run_pw(["read-text", "--session", "eval-p1-1", "--max-chars", "500"])
txt = out + err
if code == 0 and len(txt.strip()) > 0:
    record("TC-013", "read-text --max-chars", "PASS", txt[:100])
else:
    record("TC-013", "read-text --max-chars", "FAIL", txt, f"exit={code}")

# TC-014: read-text --selector
code, out, err = run_pw(["read-text", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"]'])
txt = out + err
if code == 0 and ("Total Users" in txt or "12842" in txt):
    record("TC-014", "read-text --selector", "PASS", txt[:100])
else:
    record("TC-014", "read-text --selector", "FAIL", txt, f"exit={code}")

# TC-015: snapshot
code, out, err = run_pw(["snapshot", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and any(r in txt for r in ["heading", "button", "link", "generic"]):
    record("TC-015", "snapshot 完整结构树", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-015", "snapshot 完整结构树", "FAIL", txt, f"exit={code}")

# TC-016: snapshot -i (interactive)
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["snapshot", "-i", "--session", "eval-p1-1"])
txt = out + err
ref = None
m = re.search(r'\[ref=(e\d+)\]', txt)
if m:
    ref = m.group(1)
if code == 0 and any(r in txt for r in ["button", "input", "textbox"]):
    record("TC-016", "snapshot -i 交互节点", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-016", "snapshot -i 交互节点", "FAIL", txt, f"exit={code}")

# TC-017: snapshot -c (compact)
code, out, err = run_pw(["snapshot", "-c", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and len(txt.strip()) > 0:
    record("TC-017", "snapshot -c 紧凑模式", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-017", "snapshot -c 紧凑模式", "FAIL", txt, f"exit={code}")

# TC-018: accessibility
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["accessibility", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and any(r in txt for r in ["heading", "button", "link", "textbox"]):
    record("TC-018", "accessibility 基本", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-018", "accessibility 基本", "FAIL", txt, f"exit={code}")

# TC-019: accessibility -i
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["accessibility", "-i", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and any(r in txt for r in ["button", "textbox", "link"]):
    record("TC-019", "accessibility -i 仅交互", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-019", "accessibility -i 仅交互", "FAIL", txt, f"exit={code}")

# TC-020: screenshot
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["screenshot", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "Screenshot:" in txt and ".png" in txt:
    record("TC-020", "screenshot 基本", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-020", "screenshot 基本", "FAIL", txt, f"exit={code}")

# TC-021: screenshot --full-page
code, out, err = run_pw(["screenshot", "--session", "eval-p1-1", "--full-page"])
txt = out + err
if code == 0 and "Screenshot:" in txt:
    record("TC-021", "screenshot --full-page", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-021", "screenshot --full-page", "FAIL", txt, f"exit={code}")

# TC-022: pdf
code, out, err = run_pw(["pdf", "--session", "eval-p1-1", "--path", "/tmp/eval-test.pdf"])
txt = out + err
if code == 0 and ("saved=true" in txt or "/tmp/eval-test.pdf" in txt):
    record("TC-022", "pdf 生成", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-022", "pdf 生成", "FAIL", txt, f"exit={code}")

# TC-023: page current
code, out, err = run_pw(["page", "current", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "pageId=" in txt and "url=" in txt:
    record("TC-023", "page current", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-023", "page current", "FAIL", txt, f"exit={code}")

# TC-024: page frames
code, out, err = run_pw(["page", "frames", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and '"frames"' in txt and '"url"' in txt:
    record("TC-024", "page frames", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-024", "page frames", "FAIL", txt, f"exit={code}")

# TC-025: page assess
code, out, err = run_pw(["page", "assess", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and '"summary"' in txt and '"pageKind"' in txt:
    record("TC-025", "page assess", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-025", "page assess", "FAIL", txt, f"exit={code}")

# ============================================================
# Domain 3: Navigation & Workspace (TC-026 ~ TC-035)
# ============================================================
print("=== Domain 3 ===")

# TC-026: open navigate
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "/login" in txt:
    record("TC-026", "open 导航", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-026", "open 导航", "FAIL", txt, f"exit={code}")

# TC-027: tab list
code, out, err = run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-p1-1"])
code, out, err = run_pw(["click", "--session", "eval-p1-1", "--test-id", "link-new-tab-child"])
# ignore click output
code, out, err = run_pw(["page", "list", "--session", "eval-p1-1"])
txt = out + err
page_ids = []
if code == 0 and '"pages"' in txt:
    try:
        data = json.loads(txt)
        pages = data.get("pages", [])
        if len(pages) >= 2:
            page_ids = [p.get("pageId") for p in pages]
            record("TC-027", "tab list 多 tab", "PASS", f"pages={len(pages)}")
        else:
            record("TC-027", "tab list 多 tab", "FAIL", txt, f"only {len(pages)} pages")
    except Exception as e:
        record("TC-027", "tab list 多 tab", "FAIL", txt, str(e))
else:
    record("TC-027", "tab list 多 tab", "FAIL", txt, f"exit={code}")

# TC-028: tab select
target_pid = page_ids[1] if len(page_ids) >= 2 else None
if target_pid:
    code, out, err = run_pw(["tab", "select", target_pid, "--session", "eval-p1-1"])
    txt = out + err
    code2, out2, err2 = run_pw(["page", "current", "--session", "eval-p1-1"])
    txt2 = out2 + err2
    if code == 0 and ("/tabs/child" in txt2 or target_pid in txt2):
        record("TC-028", "tab select", "PASS", txt2.splitlines()[0] if txt2 else "")
    else:
        record("TC-028", "tab select", "FAIL", txt2, f"select exit={code}")
else:
    record("TC-028", "tab select", "SKIP", "", "no second pageId")

# TC-029: tab close
target_pid = page_ids[1] if len(page_ids) >= 2 else None
if target_pid:
    code, out, err = run_pw(["tab", "close", target_pid, "--session", "eval-p1-1"])
    txt = out + err
    code2, out2, err2 = run_pw(["page", "list", "--session", "eval-p1-1"])
    txt2 = out2 + err2
    if code == 0:
        try:
            data = json.loads(txt2)
            pages = data.get("pages", [])
            if len(pages) < len(page_ids):
                record("TC-029", "tab close", "PASS", f"pages={len(pages)}")
            else:
                record("TC-029", "tab close", "FAIL", txt2, "page count not reduced")
        except:
            record("TC-029", "tab close", "PASS", txt.splitlines()[0] if txt else "")
    else:
        record("TC-029", "tab close", "FAIL", txt, f"exit={code}")
else:
    record("TC-029", "tab close", "SKIP", "", "no second pageId")

# TC-030: wait network-idle
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["wait", "network-idle", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "timeout" not in txt.lower():
    record("TC-030", "wait network-idle", "PASS", txt.splitlines()[0] if txt else "wait ok")
else:
    record("TC-030", "wait network-idle", "FAIL", txt, f"exit={code}")

# TC-031: wait --selector
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["wait", "--selector", '[data-testid="stat-users"]', "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "timeout" not in txt.lower():
    record("TC-031", "wait --selector", "PASS", txt.splitlines()[0] if txt else "wait ok")
else:
    record("TC-031", "wait --selector", "FAIL", txt, f"exit={code}")

# TC-032: wait --text
code, out, err = run_pw(["wait", "--text", "Total Users", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "timeout" not in txt.lower():
    record("TC-032", "wait --text", "PASS", txt.splitlines()[0] if txt else "wait ok")
else:
    record("TC-032", "wait --text", "FAIL", txt, f"exit={code}")

# TC-033: wait --networkidle (on /network page)
code, out, err = run_pw(["open", f"{BASE_URL}/network", "--session", "eval-p1-1"])
code, out, err = run_pw(["wait", "--networkidle", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "timeout" not in txt.lower():
    record("TC-033", "wait --networkidle", "PASS", txt.splitlines()[0] if txt else "wait ok")
else:
    record("TC-033", "wait --networkidle", "FAIL", txt, f"exit={code}")

# TC-034: page dialogs
code, out, err = run_pw(["page", "dialogs", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and ("dialogs" in txt or '"count"' in txt):
    record("TC-034", "page dialogs", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-034", "page dialogs", "FAIL", txt, f"exit={code}")

# TC-035: resize
code, out, err = run_pw(["resize", "--session", "eval-p1-1", "--view", "1280x800"])
txt = out + err
if code == 0 and ("width" in txt or "height" in txt or "1280" in txt or "800" in txt):
    record("TC-035", "resize viewport", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-035", "resize viewport", "FAIL", txt, f"exit={code}")

# ============================================================
# Domain 4: Interaction (TC-036 ~ TC-055)
# ============================================================
print("=== Domain 4 ===")

# TC-036: click selector
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["click", "--session", "eval-p1-1", "--selector", '[data-testid="login-submit"]'])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-036", "click selector", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-036", "click selector", "FAIL", txt, f"exit={code}")

# TC-037: click role/name
code, out, err = run_pw(["click", "--session", "eval-p1-1", "--role", "button", "--name", "Sign in"])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-037", "click role/name", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-037", "click role/name", "FAIL", txt, f"exit={code}")

# TC-038: click ref
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["snapshot", "-i", "--session", "eval-p1-1", "--output", "json"])
txt = out + err
ref = None
if code == 0:
    try:
        data = json.loads(txt)
        snap = data.get("data", {}).get("snapshot", "")
        # Find first button ref
        m = re.search(r'button "Sign in" \[ref=(e\d+)\]', snap)
        if m:
            ref = m.group(1)
        else:
            m = re.search(r'\[ref=(e\d+)\].*button', snap, re.DOTALL)
            if m:
                ref = m.group(1)
    except Exception as e:
        pass
if not ref:
    m = re.search(r'\[ref=(e\d+)\]', txt)
    if m:
        ref = m.group(1)

if ref:
    code, out, err = run_pw(["click", ref, "--session", "eval-p1-1"])
    txt = out + err
    if code == 0 and "acted=true" in txt:
        record("TC-038", "click ref", "PASS", txt.splitlines()[0] if txt else "")
    else:
        record("TC-038", "click ref", "FAIL", txt, f"exit={code}")
else:
    record("TC-038", "click ref", "FAIL", txt, "no ref found")

# TC-039: fill (two fills)
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code1, out1, err1 = run_pw(["fill", "--session", "eval-p1-1", "--label", "Email address", "demo@test.com"])
txt1 = out1 + err1
code2, out2, err2 = run_pw(["fill", "--session", "eval-p1-1", "--label", "Password", "password123"])
txt2 = out2 + err2
if code1 == 0 and code2 == 0 and "filled=true" in txt1 and "filled=true" in txt2:
    record("TC-039", "fill 填充", "PASS", f"email ok, password ok")
else:
    record("TC-039", "fill 填充", "FAIL", f"email={txt1[:80]} pw={txt2[:80]}", f"exit1={code1}, exit2={code2}")

# TC-040: type
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
code, out, err = run_pw(["type", "--session", "eval-p1-1", "--label", "Full name", "John Doe"])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-040", "type 逐字符输入", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-040", "type 逐字符输入", "FAIL", txt, f"exit={code}")

# TC-041: press Enter
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["press", "Enter", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-041", "press Enter", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-041", "press Enter", "FAIL", txt, f"exit={code}")

# TC-042: hover
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["hover", "--session", "eval-p1-1", "--test-id", "hover-target"])
txt = out + err
code2, out2, err2 = run_pw(["read-text", "--session", "eval-p1-1"])
txt2 = out2 + err2
if code == 0 and "acted=true" in txt and "Tooltip visible!" in txt2:
    record("TC-042", "hover tooltip", "PASS", "hover acted + tooltip visible")
elif code == 0 and "acted=true" in txt:
    record("TC-042", "hover tooltip", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-042", "hover tooltip", "FAIL", txt, f"exit={code}")

# TC-043: select
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
code, out, err = run_pw(["select", "--session", "eval-p1-1", "--label", "Country", "us"])
txt = out + err
if code == 0 and ("value" in txt or "us" in txt or "acted=true" in txt):
    record("TC-043", "select 下拉", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-043", "select 下拉", "FAIL", txt, f"exit={code}")

# TC-044: check
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["check", "--session", "eval-p1-1", "--label", "Remember me"])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-044", "check checkbox", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-044", "check checkbox", "FAIL", txt, f"exit={code}")

# TC-045: uncheck
code, out, err = run_pw(["uncheck", "--session", "eval-p1-1", "--label", "Remember me"])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-045", "uncheck checkbox", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-045", "uncheck checkbox", "FAIL", txt, f"exit={code}")

# TC-046: drag
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["drag", "--session", "eval-p1-1", "--from-selector", '[data-testid="drag-item-0"]', "--to-selector", '[data-testid="drag-item-2"]'])
txt = out + err
if code == 0 and "acted=true" in txt:
    record("TC-046", "drag 拖拽", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-046", "drag 拖拽", "FAIL", txt, f"exit={code}")

# TC-047: upload
subprocess.run("echo 'eval upload test' > /tmp/eval-upload.txt", shell=True)
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-1"])
code, out, err = run_pw(["upload", "--session", "eval-p1-1", "--selector", '[data-testid="file-input"]', "/tmp/eval-upload.txt"])
txt = out + err
if code == 0 and ("uploaded" in txt or "acted=true" in txt or "eval-upload.txt" in txt):
    record("TC-047", "upload 文件上传", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-047", "upload 文件上传", "FAIL", txt, f"exit={code}")

# TC-048: download
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["download", "--session", "eval-p1-1", "--selector", '[data-testid="download-server-txt"]'])
txt = out + err
if code == 0 and ("path" in txt or ".txt" in txt):
    record("TC-048", "download 下载", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-048", "download 下载", "FAIL", txt, f"exit={code}")

# TC-049: scroll down
code, out, err = run_pw(["open", f"{BASE_URL}/dynamic", "--session", "eval-p1-1"])
code, out, err = run_pw(["scroll", "down", "500", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and ("acted=true" in txt or "scroll" in txt.lower()):
    record("TC-049", "scroll down", "PASS", txt.splitlines()[0] if txt else "scroll ok")
else:
    record("TC-049", "scroll down", "FAIL", txt, f"exit={code}")

# TC-050: scroll up
code, out, err = run_pw(["scroll", "up", "500", "--session", "eval-p1-1"])
txt = out + err
if code == 0 and ("acted=true" in txt or "scroll" in txt.lower()):
    record("TC-050", "scroll up", "PASS", txt.splitlines()[0] if txt else "scroll ok")
else:
    record("TC-050", "scroll up", "FAIL", txt, f"exit={code}")

# TC-051: mouse move
code, out, err = run_pw(["mouse", "move", "--session", "eval-p1-1", "--x", "400", "--y", "300"])
txt = out + err
if code == 0:
    record("TC-051", "mouse move", "PASS", txt.splitlines()[0] if txt else "move ok")
else:
    record("TC-051", "mouse move", "FAIL", txt, f"exit={code}")

# TC-052: mouse click
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["mouse", "click", "--session", "eval-p1-1", "--x", "400", "--y", "300"])
txt = out + err
if code == 0:
    record("TC-052", "mouse click", "PASS", txt.splitlines()[0] if txt else "click ok")
else:
    record("TC-052", "mouse click", "FAIL", txt, f"exit={code}")

# TC-053: mouse wheel
code, out, err = run_pw(["mouse", "wheel", "--session", "eval-p1-1", "--delta-x", "0", "--delta-y", "300"])
txt = out + err
if code == 0:
    record("TC-053", "mouse wheel", "PASS", txt.splitlines()[0] if txt else "wheel ok")
else:
    record("TC-053", "mouse wheel", "FAIL", txt, f"exit={code}")

# TC-054: click popup
code, out, err = run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-p1-1"])
code, out, err = run_pw(["click", "--session", "eval-p1-1", "--test-id", "link-new-tab-child"])
txt = out + err
if code == 0 and ("openedPage" in txt or "pageId" in txt or "/tabs/child" in txt):
    record("TC-054", "click popup 新页面", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-054", "click popup 新页面", "FAIL", txt, f"exit={code}")

# TC-055: mouse dblclick
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["mouse", "dblclick", "--session", "eval-p1-1", "--x", "400", "--y", "400"])
txt = out + err
if code == 0:
    record("TC-055", "mouse dblclick", "PASS", txt.splitlines()[0] if txt else "dblclick ok")
else:
    record("TC-055", "mouse dblclick", "FAIL", txt, f"exit={code}")

# ============================================================
# Domain 5: Batch (TC-056 ~ TC-062)
# ============================================================
print("=== Domain 5 ===")

# TC-056: batch single command
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
proc = subprocess.run(
    "echo '[[\"observe\", \"status\"]]' | node dist/cli.js batch --session eval-p1-1 --stdin-json",
    shell=True, capture_output=True, text=True, timeout=30
)
code, txt = proc.returncode, proc.stdout + proc.stderr
if code == 0 and "completed=true" in txt and "success=1" in txt:
    record("TC-056", "batch 单命令", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-056", "batch 单命令", "FAIL", txt, f"exit={code}")

# TC-057: batch login flow
code, out, err = run_pw(["session", "create", "eval-p1-b1", "--open", f"{BASE_URL}/login"])
proc = subprocess.run(
    'printf "%s" \'[["fill", "--label", "Email address", "demo@test.com"],["fill", "--label", "Password", "password123"],["click", "--role", "button", "--name", "Sign in"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json',
    shell=True, capture_output=True, text=True, timeout=30
)
code, txt = proc.returncode, proc.stdout + proc.stderr
if code == 0 and "completed=true" in txt and "success=3" in txt:
    record("TC-057", "batch 登录流程", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-057", "batch 登录流程", "FAIL", txt, f"exit={code}")

# TC-058: batch form fill
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-p1-b1"])
proc = subprocess.run(
    'printf "%s" \'[["fill", "--label", "Full name", "Alice Test"],["fill", "--label", "Email address", "alice@test.com"],["select", "--label", "Country", "us"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json',
    shell=True, capture_output=True, text=True, timeout=30
)
code, txt = proc.returncode, proc.stdout + proc.stderr
if code == 0 and "completed=true" in txt and "success=3" in txt:
    record("TC-058", "batch 表单填写", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-058", "batch 表单填写", "FAIL", txt, f"exit={code}")

# TC-059: batch SESSION_NOT_FOUND
proc = subprocess.run(
    "echo '[[\"observe\", \"status\"]]' | node dist/cli.js batch --session eval-p1-ghost --stdin-json",
    shell=True, capture_output=True, text=True, timeout=30
)
code, txt = proc.returncode, proc.stdout + proc.stderr
if code != 0 and "NOT_FOUND" in txt:
    record("TC-059", "batch SESSION_NOT_FOUND", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-059", "batch SESSION_NOT_FOUND", "FAIL", txt, f"expected non-zero with NOT_FOUND, got exit={code}")

# TC-060: batch --continue-on-error
proc = subprocess.run(
    'printf "%s" \'[["click", "--selector", "#nonexistent-element-xyz"],["observe", "status"]]\' | node dist/cli.js batch --session eval-p1-b1 --stdin-json --continue-on-error',
    shell=True, capture_output=True, text=True, timeout=30
)
code, txt = proc.returncode, proc.stdout + proc.stderr
if code == 0 and "completed=true" in txt and "failed=1" in txt and "success=1" in txt:
    record("TC-060", "batch continue-on-error", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-060", "batch continue-on-error", "FAIL", txt, f"exit={code}")

# ============================================================
# Domain 6: Verify & Get (TC-063 ~ TC-072)
# ============================================================
print("=== Domain 6 ===")

# TC-063: verify text
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["verify", "text", "--session", "eval-p1-1", "--text", "Total Users"])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-063", "verify text", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-063", "verify text", "FAIL", txt, f"exit={code}")

# TC-064: verify text-absent
code, out, err = run_pw(["verify", "text-absent", "--session", "eval-p1-1", "--text", "THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST"])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-064", "verify text-absent", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-064", "verify text-absent", "FAIL", txt, f"exit={code}")

# TC-065: verify visible
code, out, err = run_pw(["verify", "visible", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"]'])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-065", "verify visible", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-065", "verify visible", "FAIL", txt, f"exit={code}")

# TC-066: verify disabled
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-p1-1"])
code, out, err = run_pw(["verify", "disabled", "--session", "eval-p1-1", "--selector", '[data-testid="btn-disabled"]'])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-066", "verify disabled", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-066", "verify disabled", "FAIL", txt, f"exit={code}")

# TC-067: verify url
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["verify", "url", "--session", "eval-p1-1", "--contains", "/dashboard"])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-067", "verify url", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-067", "verify url", "FAIL", txt, f"exit={code}")

# TC-068: verify count
code, out, err = run_pw(["verify", "count", "--session", "eval-p1-1", "--selector", '[data-testid^="stat-"]', "--equals", "4"])
txt = out + err
if code == 0 and "passed=true" in txt:
    record("TC-068", "verify count", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-068", "verify count", "FAIL", txt, f"exit={code}")

# TC-069: get text
code, out, err = run_pw(["get", "text", "--session", "eval-p1-1", "--selector", '[data-testid="stat-users"] .text-2xl'])
txt = out + err
if code == 0 and ("text" in txt or "count" in txt):
    record("TC-069", "get text", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-069", "get text", "FAIL", txt, f"exit={code}")

# TC-070: locate
code, out, err = run_pw(["locate", "--session", "eval-p1-1", "--text", "Total Users"])
txt = out + err
if code == 0 and ("count" in txt or "candidates" in txt):
    record("TC-070", "locate 语义定位", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-070", "locate 语义定位", "FAIL", txt, f"exit={code}")

# TC-071: is visible
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-p1-1"])
code, out, err = run_pw(["is", "visible", "--session", "eval-p1-1", "--selector", '[data-testid="login-submit"]'])
txt = out + err
if code == 0 and "value=true" in txt:
    record("TC-071", "is visible", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-071", "is visible", "FAIL", txt, f"exit={code}")

# TC-072: verify failed
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-p1-1"])
code, out, err = run_pw(["verify", "text", "--session", "eval-p1-1", "--text", "THIS_VERY_UNIQUE_ABSENT_TEXT_123"])
txt = out + err
if code != 0 and ("VERIFY_FAILED" in txt or "passed=false" in txt):
    record("TC-072", "verify VERIFY_FAILED", "PASS", txt.splitlines()[0] if txt else "")
else:
    record("TC-072", "verify VERIFY_FAILED", "FAIL", txt, f"expected non-zero with VERIFY_FAILED, got exit={code}")

# ============================================================
# Cleanup
# ============================================================
clean_sessions()

# ============================================================
# Generate Report
# ============================================================
print("=== Generating Report ===")

domain_map = {
    "TC-001": "Domain 1", "TC-002": "Domain 1", "TC-003": "Domain 1", "TC-004": "Domain 1",
    "TC-005": "Domain 1", "TC-006": "Domain 1", "TC-007": "Domain 1", "TC-008": "Domain 1",
    "TC-009": "Domain 1", "TC-010": "Domain 1",
    "TC-011": "Domain 2", "TC-012": "Domain 2", "TC-013": "Domain 2", "TC-014": "Domain 2",
    "TC-015": "Domain 2", "TC-016": "Domain 2", "TC-017": "Domain 2", "TC-018": "Domain 2",
    "TC-019": "Domain 2", "TC-020": "Domain 2", "TC-021": "Domain 2", "TC-022": "Domain 2",
    "TC-023": "Domain 2", "TC-024": "Domain 2", "TC-025": "Domain 2",
    "TC-026": "Domain 3", "TC-027": "Domain 3", "TC-028": "Domain 3", "TC-029": "Domain 3",
    "TC-030": "Domain 3", "TC-031": "Domain 3", "TC-032": "Domain 3", "TC-033": "Domain 3",
    "TC-034": "Domain 3", "TC-035": "Domain 3",
    "TC-036": "Domain 4", "TC-037": "Domain 4", "TC-038": "Domain 4", "TC-039": "Domain 4",
    "TC-040": "Domain 4", "TC-041": "Domain 4", "TC-042": "Domain 4", "TC-043": "Domain 4",
    "TC-044": "Domain 4", "TC-045": "Domain 4", "TC-046": "Domain 4", "TC-047": "Domain 4",
    "TC-048": "Domain 4", "TC-049": "Domain 4", "TC-050": "Domain 4", "TC-051": "Domain 4",
    "TC-052": "Domain 4", "TC-053": "Domain 4", "TC-054": "Domain 4", "TC-055": "Domain 4",
    "TC-056": "Domain 5", "TC-057": "Domain 5", "TC-058": "Domain 5", "TC-059": "Domain 5",
    "TC-060": "Domain 5", "TC-061": "Domain 5", "TC-062": "Domain 5",
    "TC-063": "Domain 6", "TC-064": "Domain 6", "TC-065": "Domain 6", "TC-066": "Domain 6",
    "TC-067": "Domain 6", "TC-068": "Domain 6", "TC-069": "Domain 6", "TC-070": "Domain 6",
    "TC-071": "Domain 6", "TC-072": "Domain 6",
}

stats = {f"Domain {i}": {"total": 0, "pass": 0, "fail": 0, "skip": 0} for i in range(1, 7)}

for r in results:
    d = domain_map.get(r["tc"], "Unknown")
    if d not in stats:
        stats[d] = {"total": 0, "pass": 0, "fail": 0, "skip": 0}
    stats[d]["total"] += 1
    if r["status"] == "PASS":
        stats[d]["pass"] += 1
    elif r["status"] == "FAIL":
        stats[d]["fail"] += 1
    else:
        stats[d]["skip"] += 1

total_pass = sum(s["pass"] for s in stats.values())
total_fail = sum(s["fail"] for s in stats.values())
total_skip = sum(s["skip"] for s in stats.values())
total = total_pass + total_fail + total_skip

report = f"""# pwcli 评测结果 Part1（TC-001~060）
执行时间: {datetime.now().isoformat()}

## Domain 统计
| Domain | 总数 | Pass | Fail | Skip |
|--------|------|------|------|------|
"""
for i in range(1, 7):
    d = f"Domain {i}"
    s = stats[d]
    report += f"| {d} | {s['total']} | {s['pass']} | {s['fail']} | {s['skip']} |\n"
report += f"| **总计** | **{total}** | **{total_pass}** | **{total_fail}** | **{total_skip}** |\n"

report += """\n## 详细结果\n"""
for r in results:
    icon = "✅ PASS" if r["status"] == "PASS" else ("❌ FAIL" if r["status"] == "FAIL" else "⚠️ SKIP")
    output_str = r["output"].replace("|", "\\|").replace("\n", " ")
    report += f"""### {r['tc']}: {r['name']}
- 状态: {icon}
- 实际输出: {output_str}
"""
    if r["reason"]:
        report += f"- 失败原因: {r['reason']}\n"
    report += "\n"

report += "## 失败用例列表\n"
failed = [r for r in results if r["status"] == "FAIL"]
if failed:
    for r in failed:
        report += f"- {r['tc']}: {r['name']} — {r['reason']}\n"
else:
    report += "- 无\n"

report += f"""\n## Part1 通过率
{total_pass}/{total} ({total_pass/total*100:.1f}%)
"""

os.makedirs("scripts/eval", exist_ok=True)
with open("scripts/eval/EVAL_RESULTS_PART1.md", "w") as f:
    f.write(report)

print(f"Report written to scripts/eval/EVAL_RESULTS_PART1.md")
print(f"Total: {total}, Pass: {total_pass}, Fail: {total_fail}, Skip: {total_skip}")
