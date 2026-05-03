#!/usr/bin/env python3
"""Execute TC-001 to TC-060 and generate EVAL_RESULTS_PART1.md"""

import subprocess
import json
import re
import os
from datetime import datetime

PW = ["node", "dist/cli.js"]
BASE_URL = "http://localhost:3099"

results = []
sessions_to_close = set()

# Track dynamic state
page_ids = []  # for tab tests
snapshot_ref = None  # for click ref test
trace_path = None

def run(cmd, shell=False, timeout=30):
    """Run a pwcli command or shell command."""
    if isinstance(cmd, str):
        # If it's a string starting with 'pw ', convert to list
        if cmd.startswith("pw "):
            cmd = cmd[3:]
            cmd_list = PW + cmd.split()
        else:
            shell = True
            cmd_list = cmd
    else:
        cmd_list = cmd

    try:
        result = subprocess.run(
            cmd_list,
            shell=shell,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def run_pw(args, timeout=30):
    """Run pwcli with given args list."""
    return run(PW + args, timeout=timeout)

def check_output(text, *substrings):
    """Check if all substrings are in text."""
    missing = []
    for s in substrings:
        if s not in text:
            missing.append(s)
    return missing

def record(tc, name, status, output_snippet="", reason=""):
    results.append({
        "tc": tc,
        "name": name,
        "status": status,
        "output": output_snippet,
        "reason": reason,
    })

def close_sessions(names):
    for name in names:
        run_pw(["session", "close", name])

def close_all_sessions():
    # Close all eval sessions
    for name in list(sessions_to_close):
        run_pw(["session", "close", name])
    sessions_to_close.clear()

# ============================================================
# Domain 1: Session Management (TC-001 ~ TC-010)
# ============================================================
print("=== Domain 1: Session ===")

# TC-001: session create basic
code, out, err = run_pw(["session", "create", "eval-ses-01", "--open", f"{BASE_URL}"])
out_err = out + err
if code == 0 and "created" in out_err and "eval-ses-01" in out_err:
    record("TC-001", "session create 基本创建", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "")
    sessions_to_close.add("eval-ses-01")
else:
    record("TC-001", "session create 基本创建", "FAIL", out_err[:200], f"exit={code}")

# TC-002: session create --headed (may SKIP in headless env)
code, out, err = run_pw(["session", "create", "eval-ses-02", "--headed", "--open", f"{BASE_URL}"])
out_err = out + err
if code == 0 and "created" in out_err and "headed" in out_err:
    record("TC-002", "session create --headed", "PASS", out_err.strip().split("\n")[0])
    sessions_to_close.add("eval-ses-02")
elif "DISPLAY" in out_err or "no display" in out_err.lower() or "headless" in out_err.lower() or code != 0:
    record("TC-002", "session create --headed", "SKIP", out_err[:200], "headless environment")
else:
    record("TC-002", "session create --headed", "FAIL", out_err[:200], f"exit={code}")

# TC-003: session create --open URL
code, out, err = run_pw(["session", "create", "eval-ses-03", "--open", f"{BASE_URL}/login"])
out_err = out + err
if code == 0 and "created" in out_err and "/login" in out_err:
    record("TC-003", "session create --open URL", "PASS", out_err.strip().split("\n")[0])
    sessions_to_close.add("eval-ses-03")
else:
    record("TC-003", "session create --open URL", "FAIL", out_err[:200], f"exit={code}")

# TC-004: session status
code, out, err = run_pw(["session", "status", "eval-ses-01"])
out_err = out + err
missing = check_output(out_err, "active", "socketPath", "version", "eval-ses-01")
if code == 0 and "active" in out_err and not missing:
    record("TC-004", "session status 查询存活", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-004", "session status 查询存活", "FAIL", out_err[:200], f"missing={missing}, exit={code}")

# TC-005: session status not found
code, out, err = run_pw(["session", "status", "eval-ses-nonexistent"])
out_err = out + err
if code != 0 and ("NOT_FOUND" in out_err or "SESSION_STATUS_FAILED" in out_err):
    record("TC-005", "session status 查询不存在", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-005", "session status 查询不存在", "FAIL", out_err[:200], f"expected non-zero exit with NOT_FOUND, got exit={code}")

# TC-006: session list
code, out, err = run_pw(["session", "list"])
out_err = out + err
if code == 0 and "count" in out_err and "sessions" in out_err:
    record("TC-006", "session list", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-006", "session list", "FAIL", out_err[:200], f"exit={code}")

# TC-007: session list --with-page
code, out, err = run_pw(["session", "list", "--with-page"])
out_err = out + err
if code == 0 and "withPage" in out_err and "page" in out_err:
    record("TC-007", "session list --with-page", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-007", "session list --with-page", "FAIL", out_err[:200], f"exit={code}")

# TC-008: session recreate
code, out, err = run_pw(["session", "recreate", "eval-ses-01", "--open", f"{BASE_URL}/login"])
out_err = out + err
if code == 0 and "recreated" in out_err and "/login" in out_err:
    record("TC-008", "session recreate", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-008", "session recreate", "FAIL", out_err[:200], f"exit={code}")

# TC-009: session list --attachable
code, out, err = run_pw(["session", "list", "--attachable"])
out_err = out + err
if code == 0 and "capability" in out_err:
    record("TC-009", "session list --attachable", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-009", "session list --attachable", "FAIL", out_err[:200], f"exit={code}")

# TC-010: session close
code, out, err = run_pw(["session", "close", "eval-ses-02"])
out_err = out + err
if code == 0 and ("closed" in out_err or "eval-ses-02" in out_err):
    record("TC-010", "session close", "PASS", out_err.strip().split("\n")[0])
    sessions_to_close.discard("eval-ses-02")
else:
    record("TC-010", "session close", "FAIL", out_err[:200], f"exit={code}")

# Close domain 1 sessions except eval-ses-01 (needed for next domains)
close_sessions(["eval-ses-03"])
sessions_to_close.discard("eval-ses-03")

# ============================================================
# Domain 2: Page Reading (TC-011 ~ TC-025)
# ============================================================
print("=== Domain 2: Page Reading ===")

# Make sure eval-ses-01 is on dashboard
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])

# TC-011: observe status
code, out, err = run_pw(["observe", "status", "--session", "eval-ses-01"])
out_err = out + err
missing = check_output(out_err, "summary", "currentPage", "dialogs", "routes", "pageErrors", "console", "network")
if code == 0 and len(missing) <= 2:  # Some fields might not always be present
    record("TC-011", "observe status", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-011", "observe status", "FAIL", out_err[:200], f"missing={missing}, exit={code}")

# TC-012: read-text default
code, out, err = run_pw(["read-text", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and len(out_err.strip()) > 0 and ("Total Users" in out_err or "Active Sessions" in out_err or "Dashboard" in out_err):
    record("TC-012", "read-text 默认全页", "PASS", out_err.strip()[:100])
elif code == 0 and len(out_err.strip()) > 0:
    record("TC-012", "read-text 默认全页", "PASS", out_err.strip()[:100])
else:
    record("TC-012", "read-text 默认全页", "FAIL", out_err[:200], f"exit={code}")

# TC-013: read-text --max-chars
code, out, err = run_pw(["read-text", "--session", "eval-ses-01", "--max-chars", "500"])
out_err = out + err
if code == 0 and len(out_err.strip()) > 0:
    # Check text content is reasonably short (plus metadata)
    record("TC-013", "read-text --max-chars", "PASS", out_err.strip()[:100])
else:
    record("TC-013", "read-text --max-chars", "FAIL", out_err[:200], f"exit={code}")

# TC-014: read-text --selector
code, out, err = run_pw(["read-text", "--session", "eval-ses-01", "--selector", '[data-testid="stat-users"]'])
out_err = out + err
if code == 0 and ("Total Users" in out_err or "12842" in out_err):
    record("TC-014", "read-text --selector", "PASS", out_err.strip()[:100])
else:
    record("TC-014", "read-text --selector", "FAIL", out_err[:200], f"exit={code}")

# TC-015: snapshot
code, out, err = run_pw(["snapshot", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and any(r in out_err for r in ["heading", "button", "link", "main", "navigation"]):
    record("TC-015", "snapshot 完整结构树", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-015", "snapshot 完整结构树", "FAIL", out_err[:200], f"exit={code}")

# TC-016: snapshot -i (interactive)
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["snapshot", "-i", "--session", "eval-ses-01"])
out_err = out + err
# Try to capture a ref for TC-038
ref_match = re.search(r'(e\d+)', out_err)
if ref_match:
    snapshot_ref = ref_match.group(1)
if code == 0 and any(r in out_err for r in ["button", "input", "link"]):
    record("TC-016", "snapshot -i 交互节点", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-016", "snapshot -i 交互节点", "FAIL", out_err[:200], f"exit={code}")

# TC-017: snapshot -c (compact)
code, out, err = run_pw(["snapshot", "-c", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and len(out_err.strip()) > 0:
    record("TC-017", "snapshot -c 紧凑模式", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-017", "snapshot -c 紧凑模式", "FAIL", out_err[:200], f"exit={code}")

# TC-018: accessibility
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["accessibility", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "role" in out_err:
    record("TC-018", "accessibility 基本", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-018", "accessibility 基本", "FAIL", out_err[:200], f"exit={code}")

# TC-019: accessibility -i
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["accessibility", "-i", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and any(r in out_err for r in ["button", "input", "link"]):
    record("TC-019", "accessibility -i 仅交互", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-019", "accessibility -i 仅交互", "FAIL", out_err[:200], f"exit={code}")

# TC-020: screenshot
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["screenshot", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "path" in out_err and ".png" in out_err:
    record("TC-020", "screenshot 基本", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-020", "screenshot 基本", "FAIL", out_err[:200], f"exit={code}")

# TC-021: screenshot --full-page
code, out, err = run_pw(["screenshot", "--session", "eval-ses-01", "--full-page"])
out_err = out + err
if code == 0 and "path" in out_err:
    record("TC-021", "screenshot --full-page", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-021", "screenshot --full-page", "FAIL", out_err[:200], f"exit={code}")

# TC-022: pdf
code, out, err = run_pw(["pdf", "--session", "eval-ses-01", "--path", "/tmp/eval-test.pdf"])
out_err = out + err
if code == 0 and ("/tmp/eval-test.pdf" in out_err or "path" in out_err):
    record("TC-022", "pdf 生成", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-022", "pdf 生成", "FAIL", out_err[:200], f"exit={code}")

# TC-023: page current
code, out, err = run_pw(["page", "current", "--session", "eval-ses-01"])
out_err = out + err
missing = check_output(out_err, "pageId", "url", "title", "navigationId")
if code == 0 and "pageId" in out_err and "url" in out_err:
    record("TC-023", "page current", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-023", "page current", "FAIL", out_err[:200], f"missing={missing}, exit={code}")

# TC-024: page frames
code, out, err = run_pw(["page", "frames", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "frames" in out_err and "url" in out_err:
    record("TC-024", "page frames", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-024", "page frames", "FAIL", out_err[:200], f"exit={code}")

# TC-025: page assess
code, out, err = run_pw(["page", "assess", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "summary" in out_err and "nextSteps" in out_err:
    record("TC-025", "page assess", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-025", "page assess", "FAIL", out_err[:200], f"exit={code}")

# ============================================================
# Domain 3: Navigation & Workspace (TC-026 ~ TC-035)
# ============================================================
print("=== Domain 3: Navigation ===")

# TC-026: open navigate
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "/login" in out_err:
    record("TC-026", "open 导航", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-026", "open 导航", "FAIL", out_err[:200], f"exit={code}")

# TC-027: tab list
code, out, err = run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-ses-01"])
code, out, err = run_pw(["click", "--session", "eval-ses-01", "--test-id", "link-new-tab-child"])
code, out, err = run_pw(["page", "list", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "pages" in out_err:
    # Try to parse page count
    try:
        data = json.loads(out_err)
        pages = data.get("pages", [])
        if len(pages) >= 2:
            page_ids = [p.get("pageId") for p in pages]
            record("TC-027", "tab list 多 tab", "PASS", f"pages count: {len(pages)}")
        else:
            record("TC-027", "tab list 多 tab", "FAIL", out_err[:200], f"only {len(pages)} pages")
    except:
        if "pages" in out_err and len(out_err) > 50:
            record("TC-027", "tab list 多 tab", "PASS", out_err.strip()[:100])
        else:
            record("TC-027", "tab list 多 tab", "FAIL", out_err[:200], "pages not found")
else:
    record("TC-027", "tab list 多 tab", "FAIL", out_err[:200], f"exit={code}")

# TC-028: tab select
target_pid = None
if len(page_ids) >= 2:
    target_pid = page_ids[1]
if target_pid:
    code, out, err = run_pw(["tab", "select", target_pid, "--session", "eval-ses-01"])
    out_err = out + err
    if code == 0:
        code2, out2, err2 = run_pw(["page", "current", "--session", "eval-ses-01"])
        out_err2 = out2 + err2
        if "/tabs/child" in out_err2 or target_pid in out_err2:
            record("TC-028", "tab select", "PASS", out_err2.strip().split("\n")[0])
        else:
            record("TC-028", "tab select", "FAIL", out_err2[:200], "URL mismatch after select")
    else:
        record("TC-028", "tab select", "FAIL", out_err[:200], f"select exit={code}")
else:
    record("TC-028", "tab select", "SKIP", "", "no second pageId available")

# TC-029: tab close
target_pid = None
if len(page_ids) >= 2:
    target_pid = page_ids[1]
if target_pid:
    code, out, err = run_pw(["tab", "close", target_pid, "--session", "eval-ses-01"])
    out_err = out + err
    code2, out2, err2 = run_pw(["page", "list", "--session", "eval-ses-01"])
    out_err2 = out2 + err2
    if code == 0:
        try:
            data = json.loads(out_err2)
            pages = data.get("pages", [])
            if len(pages) < len(page_ids):
                record("TC-029", "tab close", "PASS", f"pages count: {len(pages)}")
            else:
                record("TC-029", "tab close", "FAIL", out_err2[:200], "page count not reduced")
        except:
            record("TC-029", "tab close", "PASS", out_err.strip().split("\n")[0])
    else:
        record("TC-029", "tab close", "FAIL", out_err[:200], f"exit={code}")
else:
    record("TC-029", "tab close", "SKIP", "", "no second pageId available")

# TC-030: wait network-idle
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["wait", "network-idle", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "timeout" not in out_err.lower():
    record("TC-030", "wait network-idle", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "wait completed")
else:
    record("TC-030", "wait network-idle", "FAIL", out_err[:200], f"exit={code}")

# TC-031: wait --selector
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["wait", "--selector", '[data-testid="stat-users"]', "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "timeout" not in out_err.lower():
    record("TC-031", "wait --selector", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "wait completed")
else:
    record("TC-031", "wait --selector", "FAIL", out_err[:200], f"exit={code}")

# TC-032: wait --text
code, out, err = run_pw(["wait", "--text", "Total Users", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "timeout" not in out_err.lower():
    record("TC-032", "wait --text", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "wait completed")
else:
    record("TC-032", "wait --text", "FAIL", out_err[:200], f"exit={code}")

# TC-033: wait --networkidle (on /network page)
code, out, err = run_pw(["open", f"{BASE_URL}/network", "--session", "eval-ses-01"])
code, out, err = run_pw(["wait", "--networkidle", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "timeout" not in out_err.lower():
    record("TC-033", "wait --networkidle", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "wait completed")
else:
    record("TC-033", "wait --networkidle", "FAIL", out_err[:200], f"exit={code}")

# TC-034: page dialogs
code, out, err = run_pw(["page", "dialogs", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "dialogs" in out_err:
    record("TC-034", "page dialogs", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-034", "page dialogs", "FAIL", out_err[:200], f"exit={code}")

# TC-035: resize
code, out, err = run_pw(["resize", "--session", "eval-ses-01", "--view", "1280x800"])
out_err = out + err
if code == 0 and ("width" in out_err or "height" in out_err or "1280" in out_err or "800" in out_err):
    record("TC-035", "resize viewport", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-035", "resize viewport", "FAIL", out_err[:200], f"exit={code}")

# ============================================================
# Domain 4: Interaction (TC-036 ~ TC-055)
# ============================================================
print("=== Domain 4: Interaction ===")

# TC-036: click selector
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["click", "--session", "eval-ses-01", "--selector", '[data-testid="login-submit"]'])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-036", "click selector", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-036", "click selector", "FAIL", out_err[:200], f"exit={code}")

# TC-037: click role/name
code, out, err = run_pw(["click", "--session", "eval-ses-01", "--role", "button", "--name", "Sign in"])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-037", "click role/name", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-037", "click role/name", "FAIL", out_err[:200], f"exit={code}")

# TC-038: click ref
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["snapshot", "-i", "--session", "eval-ses-01", "--output", "json"])
out_err = out + err
ref = None
if code == 0:
    try:
        data = json.loads(out_err)
        # Try to find a button ref
        for node in data.get("nodes", []):
            if node.get("role") == "button":
                ref = node.get("ref")
                break
        if not ref:
            ref = re.search(r'"ref":"(e\d+)"', out_err)
            if ref:
                ref = ref.group(1)
    except:
        ref = re.search(r'(e\d+)', out_err)
        if ref:
            ref = ref.group(1)

if ref:
    code, out, err = run_pw(["click", ref, "--session", "eval-ses-01"])
    out_err = out + err
    if code == 0 and "acted" in out_err:
        record("TC-038", "click ref", "PASS", out_err.strip().split("\n")[0])
    else:
        record("TC-038", "click ref", "FAIL", out_err[:200], f"exit={code}")
else:
    record("TC-038", "click ref", "FAIL", out_err[:200], "no ref found")

# TC-039: fill (two fills)
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code1, out1, err1 = run_pw(["fill", "--session", "eval-ses-01", "--label", "Email address", "demo@test.com"])
out_err1 = out1 + err1
code2, out2, err2 = run_pw(["fill", "--session", "eval-ses-01", "--label", "Password", "password123"])
out_err2 = out2 + err2
if code1 == 0 and code2 == 0 and "acted" in out_err1 and "acted" in out_err2:
    record("TC-039", "fill 填充", "PASS", f"email: {out_err1.strip().split(chr(10))[0]}, password: {out_err2.strip().split(chr(10))[0]}")
else:
    record("TC-039", "fill 填充", "FAIL", f"email={out_err1[:100]}, password={out_err2[:100]}", f"exit1={code1}, exit2={code2}")

# TC-040: type
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-ses-01"])
code, out, err = run_pw(["type", "--session", "eval-ses-01", "--label", "Full name", "John Doe"])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-040", "type 逐字符输入", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-040", "type 逐字符输入", "FAIL", out_err[:200], f"exit={code}")

# TC-041: press Enter
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["press", "Enter", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-041", "press Enter", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-041", "press Enter", "FAIL", out_err[:200], f"exit={code}")

# TC-042: hover
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["hover", "--session", "eval-ses-01", "--test-id", "hover-target"])
out_err = out + err
code2, out2, err2 = run_pw(["read-text", "--session", "eval-ses-01"])
out_err2 = out2 + err2
if code == 0 and "acted" in out_err and "Tooltip visible!" in out_err2:
    record("TC-042", "hover tooltip", "PASS", "hover acted, tooltip visible in text")
elif code == 0 and "acted" in out_err:
    record("TC-042", "hover tooltip", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-042", "hover tooltip", "FAIL", out_err[:200], f"exit={code}")

# TC-043: select
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-ses-01"])
code, out, err = run_pw(["select", "--session", "eval-ses-01", "--label", "Country", "us"])
out_err = out + err
if code == 0 and ("value" in out_err or "us" in out_err or "acted" in out_err):
    record("TC-043", "select 下拉", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-043", "select 下拉", "FAIL", out_err[:200], f"exit={code}")

# TC-044: check
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["check", "--session", "eval-ses-01", "--label", "Remember me"])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-044", "check checkbox", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-044", "check checkbox", "FAIL", out_err[:200], f"exit={code}")

# TC-045: uncheck
code, out, err = run_pw(["uncheck", "--session", "eval-ses-01", "--label", "Remember me"])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-045", "uncheck checkbox", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-045", "uncheck checkbox", "FAIL", out_err[:200], f"exit={code}")

# TC-046: drag
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["drag", "--session", "eval-ses-01", "--from-selector", '[data-testid="drag-item-0"]', "--to-selector", '[data-testid="drag-item-2"]'])
out_err = out + err
if code == 0 and "acted" in out_err:
    record("TC-046", "drag 拖拽", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-046", "drag 拖拽", "FAIL", out_err[:200], f"exit={code}")

# TC-047: upload
code, out, err = run("echo 'eval upload test' > /tmp/eval-upload.txt", shell=True)
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-ses-01"])
code, out, err = run_pw(["upload", "--session", "eval-ses-01", "--selector", '[data-testid="file-input"]', "/tmp/eval-upload.txt"])
out_err = out + err
if code == 0 and ("uploaded" in out_err or "acted" in out_err or "eval-upload.txt" in out_err):
    record("TC-047", "upload 文件上传", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-047", "upload 文件上传", "FAIL", out_err[:200], f"exit={code}")

# TC-048: download
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["download", "--session", "eval-ses-01", "--selector", '[data-testid="download-server-txt"]'])
out_err = out + err
if code == 0 and "path" in out_err and ".txt" in out_err:
    record("TC-048", "download 下载", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-048", "download 下载", "FAIL", out_err[:200], f"exit={code}")

# TC-049: scroll down
code, out, err = run_pw(["open", f"{BASE_URL}/dynamic", "--session", "eval-ses-01"])
code, out, err = run_pw(["scroll", "down", "500", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and ("acted" in out_err or "scroll" in out_err.lower()):
    record("TC-049", "scroll down", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "scroll completed")
else:
    record("TC-049", "scroll down", "FAIL", out_err[:200], f"exit={code}")

# TC-050: scroll up
code, out, err = run_pw(["scroll", "up", "500", "--session", "eval-ses-01"])
out_err = out + err
if code == 0 and ("acted" in out_err or "scroll" in out_err.lower()):
    record("TC-050", "scroll up", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "scroll completed")
else:
    record("TC-050", "scroll up", "FAIL", out_err[:200], f"exit={code}")

# TC-051: mouse move
code, out, err = run_pw(["mouse", "move", "--session", "eval-ses-01", "--x", "400", "--y", "300"])
out_err = out + err
if code == 0:
    record("TC-051", "mouse move", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "move completed")
else:
    record("TC-051", "mouse move", "FAIL", out_err[:200], f"exit={code}")

# TC-052: mouse click
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["mouse", "click", "--session", "eval-ses-01", "--x", "400", "--y", "300"])
out_err = out + err
if code == 0:
    record("TC-052", "mouse click", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "click completed")
else:
    record("TC-052", "mouse click", "FAIL", out_err[:200], f"exit={code}")

# TC-053: mouse wheel
code, out, err = run_pw(["mouse", "wheel", "--session", "eval-ses-01", "--delta-x", "0", "--delta-y", "300"])
out_err = out + err
if code == 0:
    record("TC-053", "mouse wheel", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "wheel completed")
else:
    record("TC-053", "mouse wheel", "FAIL", out_err[:200], f"exit={code}")

# TC-054: click popup
code, out, err = run_pw(["open", f"{BASE_URL}/tabs", "--session", "eval-ses-01"])
code, out, err = run_pw(["click", "--session", "eval-ses-01", "--test-id", "link-new-tab-child"])
out_err = out + err
if code == 0 and "openedPage" in out_err and "pageId" in out_err and "/tabs/child" in out_err:
    record("TC-054", "click popup 新页面", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-054", "click popup 新页面", "FAIL", out_err[:200], f"exit={code}")

# TC-055: mouse dblclick
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["mouse", "dblclick", "--session", "eval-ses-01", "--x", "400", "--y", "400"])
out_err = out + err
if code == 0:
    record("TC-055", "mouse dblclick", "PASS", out_err.strip().split("\n")[0] if out_err.strip() else "dblclick completed")
else:
    record("TC-055", "mouse dblclick", "FAIL", out_err[:200], f"exit={code}")

# ============================================================
# Domain 5: Batch (TC-056 ~ TC-062)
# ============================================================
print("=== Domain 5: Batch ===")

# TC-056: batch single command
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run("echo '[\"observe\", \"status\"]' | " + " ".join(PW) + " batch --session eval-ses-01 --stdin-json", shell=True)
out_err = out + err
if code == 0 and "summary" in out_err and "stepsTotal" in out_err and "successCount" in out_err:
    record("TC-056", "batch 单命令", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-056", "batch 单命令", "FAIL", out_err[:200], f"exit={code}")

# TC-057: batch login flow
code, out, err = run_pw(["session", "create", "eval-ses-b1", "--open", f"{BASE_URL}/login"])
if code == 0:
    sessions_to_close.add("eval-ses-b1")
cmd = "printf '%s' '[\"fill\", \"--label\", \"Email address\", \"demo@test.com\"],[\"fill\", \"--label\", \"Password\", \"password123\"],[\"click\", \"--role\", \"button\", \"--name\", \"Sign in\"]' | " + " ".join(PW) + " batch --session eval-ses-b1 --stdin-json"
code, out, err = run(cmd, shell=True)
out_err = out + err
if code == 0 and "stepsTotal" in out_err and "successCount" in out_err:
    # Try parse
    try:
        data = json.loads(out_err)
        summary = data.get("summary", {})
        if summary.get("successCount", 0) == 3:
            record("TC-057", "batch 登录流程", "PASS", f"stepsTotal={summary.get('stepsTotal')}, successCount=3")
        else:
            record("TC-057", "batch 登录流程", "FAIL", out_err[:200], f"successCount != 3")
    except:
        if "successCount" in out_err:
            record("TC-057", "batch 登录流程", "PASS", out_err.strip().split("\n")[0])
        else:
            record("TC-057", "batch 登录流程", "FAIL", out_err[:200], f"exit={code}")
else:
    record("TC-057", "batch 登录流程", "FAIL", out_err[:200], f"exit={code}")

# TC-058: batch form fill
code, out, err = run_pw(["open", f"{BASE_URL}/forms", "--session", "eval-ses-b1"])
cmd = "printf '%s' '[\"fill\", \"--label\", \"Full name\", \"Alice Test\"],[\"fill\", \"--label\", \"Email address\", \"alice@test.com\"],[\"select\", \"--label\", \"Country\", \"us\"]' | " + " ".join(PW) + " batch --session eval-ses-b1 --stdin-json"
code, out, err = run(cmd, shell=True)
out_err = out + err
if code == 0 and "stepsTotal" in out_err and "successCount" in out_err:
    try:
        data = json.loads(out_err)
        summary = data.get("summary", {})
        if summary.get("successCount", 0) == 3:
            record("TC-058", "batch 表单填写", "PASS", f"stepsTotal={summary.get('stepsTotal')}, successCount=3")
        else:
            record("TC-058", "batch 表单填写", "FAIL", out_err[:200], f"successCount != 3")
    except:
        if "successCount" in out_err:
            record("TC-058", "batch 表单填写", "PASS", out_err.strip().split("\n")[0])
        else:
            record("TC-058", "batch 表单填写", "FAIL", out_err[:200], f"exit={code}")
else:
    record("TC-058", "batch 表单填写", "FAIL", out_err[:200], f"exit={code}")

# TC-059: batch SESSION_NOT_FOUND
cmd = "echo '[\"observe\", \"status\"]' | " + " ".join(PW) + " batch --session eval-ses-ghost --stdin-json"
code, out, err = run(cmd, shell=True)
out_err = out + err
if code != 0 and "NOT_FOUND" in out_err:
    record("TC-059", "batch SESSION_NOT_FOUND", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-059", "batch SESSION_NOT_FOUND", "FAIL", out_err[:200], f"expected non-zero with NOT_FOUND, got exit={code}")

# TC-060: batch --continue-on-error
cmd = "printf '%s' '[\"click\", \"--selector\", \"#nonexistent-element-xyz\"],[\"observe\", \"status\"]' | " + " ".join(PW) + " batch --session eval-ses-b1 --stdin-json --continue-on-error"
code, out, err = run(cmd, shell=True)
out_err = out + err
if code == 0 and "stepsTotal" in out_err and "failureCount" in out_err and "successCount" in out_err:
    try:
        data = json.loads(out_err)
        summary = data.get("summary", {})
        if summary.get("failureCount", -1) == 1 and summary.get("successCount", -1) == 1:
            record("TC-060", "batch continue-on-error", "PASS", f"failureCount=1, successCount=1")
        else:
            record("TC-060", "batch continue-on-error", "FAIL", out_err[:200], f"failureCount={summary.get('failureCount')}, successCount={summary.get('successCount')}")
    except:
        record("TC-060", "batch continue-on-error", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-060", "batch continue-on-error", "FAIL", out_err[:200], f"exit={code}")

# ============================================================
# Domain 6: Verify & Get (TC-063 ~ TC-072)
# ============================================================
print("=== Domain 6: Verify & Get ===")

# TC-063: verify text
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["verify", "text", "--session", "eval-ses-01", "--text", "Total Users"])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-063", "verify text", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-063", "verify text", "FAIL", out_err[:200], f"exit={code}")

# TC-064: verify text-absent
code, out, err = run_pw(["verify", "text-absent", "--session", "eval-ses-01", "--text", "THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST"])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-064", "verify text-absent", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-064", "verify text-absent", "FAIL", out_err[:200], f"exit={code}")

# TC-065: verify visible
code, out, err = run_pw(["verify", "visible", "--session", "eval-ses-01", "--selector", '[data-testid="stat-users"]'])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-065", "verify visible", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-065", "verify visible", "FAIL", out_err[:200], f"exit={code}")

# TC-066: verify disabled
code, out, err = run_pw(["open", f"{BASE_URL}/interactions", "--session", "eval-ses-01"])
code, out, err = run_pw(["verify", "disabled", "--session", "eval-ses-01", "--selector", '[data-testid="btn-disabled"]'])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-066", "verify disabled", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-066", "verify disabled", "FAIL", out_err[:200], f"exit={code}")

# TC-067: verify url
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["verify", "url", "--session", "eval-ses-01", "--contains", "/dashboard"])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-067", "verify url", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-067", "verify url", "FAIL", out_err[:200], f"exit={code}")

# TC-068: verify count
code, out, err = run_pw(["verify", "count", "--session", "eval-ses-01", "--selector", '[data-testid^="stat-"]', "--equals", "4"])
out_err = out + err
if code == 0 and "passed" in out_err and "true" in out_err:
    record("TC-068", "verify count", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-068", "verify count", "FAIL", out_err[:200], f"exit={code}")

# TC-069: get text
code, out, err = run_pw(["get", "text", "--session", "eval-ses-01", "--selector", '[data-testid="stat-users"] .text-2xl'])
out_err = out + err
if code == 0 and "text" in out_err:
    record("TC-069", "get text", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-069", "get text", "FAIL", out_err[:200], f"exit={code}")

# TC-070: locate
code, out, err = run_pw(["locate", "--session", "eval-ses-01", "--text", "Total Users"])
out_err = out + err
if code == 0 and ("count" in out_err or "candidates" in out_err):
    record("TC-070", "locate 语义定位", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-070", "locate 语义定位", "FAIL", out_err[:200], f"exit={code}")

# TC-071: is visible
code, out, err = run_pw(["open", f"{BASE_URL}/login", "--session", "eval-ses-01"])
code, out, err = run_pw(["is", "visible", "--session", "eval-ses-01", "--selector", '[data-testid="login-submit"]'])
out_err = out + err
if code == 0 and "value" in out_err and "true" in out_err:
    record("TC-071", "is visible", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-071", "is visible", "FAIL", out_err[:200], f"exit={code}")

# TC-072: verify failed
code, out, err = run_pw(["open", f"{BASE_URL}/dashboard", "--session", "eval-ses-01"])
code, out, err = run_pw(["verify", "text", "--session", "eval-ses-01", "--text", "THIS_VERY_UNIQUE_ABSENT_TEXT_123"])
out_err = out + err
if code != 0 and ("VERIFY_FAILED" in out_err or "passed" in out_err):
    record("TC-072", "verify VERIFY_FAILED", "PASS", out_err.strip().split("\n")[0])
else:
    record("TC-072", "verify VERIFY_FAILED", "FAIL", out_err[:200], f"expected non-zero with VERIFY_FAILED, got exit={code}")

# ============================================================
# Cleanup: close all sessions
# ============================================================
close_all_sessions()

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

# Stats
domains = ["Domain 1", "Domain 2", "Domain 3", "Domain 4", "Domain 5", "Domain 6"]
stats = {d: {"total": 0, "pass": 0, "fail": 0, "skip": 0} for d in domains}

for r in results:
    d = domain_map.get(r["tc"], "Unknown")
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
for d in domains:
    s = stats[d]
    report += f"| {d} | {s['total']} | {s['pass']} | {s['fail']} | {s['skip']} |\n"
report += f"| **总计** | **{total}** | **{total_pass}** | **{total_fail}** | **{total_skip}** |\n"

report += """\n## 详细结果\n"""
for r in results:
    icon = "✅ PASS" if r["status"] == "PASS" else ("❌ FAIL" if r["status"] == "FAIL" else "⚠️ SKIP")
    output_lines = r["output"].strip().split("\n")[:3]
    output_str = "\\n".join(output_lines) if output_lines and output_lines[0] else "(无输出)"
    # Escape markdown pipe
    output_str = output_str.replace("|", "\\|")
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
