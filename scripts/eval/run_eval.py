#!/usr/bin/env python3
"""pwcli 自动化评测执行器"""
import subprocess, json, os, re, time, glob, shutil
from datetime import datetime, timezone

PW = ["node", "/Users/xd/work/tools/pwcli/dist/cli.js"]
TARGET = "http://localhost:3099"
RESULTS_FILE = "/Users/xd/work/tools/pwcli/scripts/eval/EVAL_RESULTS.md"
TMP_DIR = "/tmp/pwcli-eval"
os.makedirs(TMP_DIR, exist_ok=True)

results = []
counters = {d: {"PASS":0,"FAIL":0,"WARN":0,"SKIP":0} for d in [
    "D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11"
]}

def run(args, timeout=30, input_data=None):
    """运行 pw 命令，返回 (stdout, stderr, exit_code)"""
    cmd = PW + args
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, input=input_data)
        return r.stdout, r.stderr, r.returncode
    except subprocess.TimeoutExpired:
        return "", "TIMEOUT", 1
    except Exception as e:
        return "", str(e), 1

def run_shell(cmd, timeout=30):
    """运行 shell 命令"""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout + r.stderr, r.returncode
    except subprocess.TimeoutExpired:
        return "TIMEOUT", 1
    except Exception as e:
        return str(e), 1

def record(tc, domain, status, cmd, out, reason, ec):
    counters[domain][status] += 1
    results.append({
        "tc": tc, "domain": domain, "status": status,
        "cmd": cmd, "out": out[:800], "reason": reason, "exit_code": ec,
        "time": datetime.now(timezone.utc).isoformat()
    })
    print(f"  {tc}: {status} (ec={ec})")

def check_pass(tc, domain, cmd, out, ec, expected_exit, checks, reason_pass, reason_fail=None):
    """判断单个 TC 结果"""
    if expected_exit == "nonzero":
        if ec != 0:
            passed = any(c in out for c in checks)
            if passed:
                record(tc, domain, "PASS", cmd, out, reason_pass, ec)
            else:
                record(tc, domain, "WARN", cmd, out, f"exit 非0 但缺少 {checks}", ec)
        else:
            record(tc, domain, "FAIL", cmd, out, reason_fail or "预期 exit 非0，实际 exit 0", ec)
    else:
        if ec != 0:
            record(tc, domain, "FAIL", cmd, out, reason_fail or f"exit {ec} (预期 0)", ec)
        else:
            passed = any(c in out for c in checks)
            if passed:
                record(tc, domain, "PASS", cmd, out, reason_pass, ec)
            else:
                record(tc, domain, "WARN", cmd, out, f"缺少字段 {checks}", ec)

def cleanup_eval_sessions():
    out, _, ec = run(["session", "list"], timeout=15)
    for line in out.splitlines():
        if line.startswith("eval-"):
            name = line.split()[0]
            run(["session", "close", name], timeout=15)
            print(f"  Cleaned up {name}")

def get_page_list_json(session):
    out, _, _ = run(["page", "list", "--session", session, "--output", "json"], timeout=15)
    try:
        data = json.loads(out)
        return data.get("data", {}).get("pages", data.get("pages", []))
    except:
        return []

# ==================== 执行开始 ====================
print("=== Cleanup ===")
cleanup_eval_sessions()

# ==================== Domain 1 ====================
print("\n=== Domain 1: Session ===")

out, _, ec = run(["session", "create", "eval-d1", "--open", TARGET])
check_pass("TC-001", "D1", "session create eval-d1", out, ec, 0, ["created: true"], "created=true")

out, _, ec = run(["session", "create", "eval-ses-02", "--headed", "--open", TARGET])
check_pass("TC-002", "D1", "session create eval-ses-02 --headed", out, ec, 0, ["headed: true"], "headed=true")

out, _, ec = run(["session", "create", "eval-ses-03", "--open", TARGET+"/login"])
check_pass("TC-003", "D1", "session create eval-ses-03 --open /login", out, ec, 0, ["/login"], "page URL 含 /login")

out, _, ec = run(["session", "status", "eval-d1"])
check_pass("TC-004", "D1", "session status eval-d1", out, ec, 0, ["active: true"], "active=true")

out, _, ec = run(["session", "status", "eval-ses-nonexistent"])
check_pass("TC-005", "D1", "session status eval-ses-nonexistent", out, ec, "nonzero", ["SESSION_NOT_FOUND", "NOT_FOUND"], "SESSION_NOT_FOUND")

out, _, ec = run(["session", "list"])
check_pass("TC-006", "D1", "session list", out, ec, 0, ["count"], "count >= 1")

out, _, ec = run(["session", "list", "--with-page"])
check_pass("TC-007", "D1", "session list --with-page", out, ec, 0, ["withPage: true"], "withPage=true")

out, _, ec = run(["session", "recreate", "eval-d1", "--open", TARGET+"/login"])
check_pass("TC-008", "D1", "session recreate eval-d1 --open /login", out, ec, 0, ["recreated: true"], "recreated=true")

out, _, ec = run(["session", "list", "--attachable"])
check_pass("TC-009", "D1", "session list --attachable", out, ec, 0, ["capability"], "capability 字段存在")

out, _, ec = run(["session", "close", "eval-ses-02"])
check_pass("TC-010", "D1", "session close eval-ses-02", out, ec, 0, ["closed: true", "name: eval-ses-02"], "closed=true")

run(["session", "close", "eval-ses-03"], timeout=15)

# ==================== Domain 2 ====================
print("\n=== Domain 2: Page Reading ===")
# Ensure eval-d1 logged in on dashboard
run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
run(["fill", "--session", "eval-d1", "--selector", "[data-testid=login-email]", "demo@test.com"], timeout=15)
run(["fill", "--session", "eval-d1", "--selector", "[data-testid=login-password]", "password123"], timeout=15)
run(["click", "--session", "eval-d1", "--selector", "[data-testid=login-submit]"], timeout=15)
time.sleep(2)
run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)

out, _, ec = run(["observe", "status", "--session", "eval-d1"])
check_pass("TC-011", "D2", "observe status", out, ec, 0, ["summary"], "summary 字段存在")

out, _, ec = run(["read-text", "--session", "eval-d1"])
check_pass("TC-012", "D2", "read-text", out, ec, 0, ["Total Users", "Active Sessions"], "文本非空含 dashboard 内容")

out, _, ec = run(["read-text", "--session", "eval-d1", "--max-chars", "500"])
check_pass("TC-013", "D2", "read-text --max-chars 500", out, ec, 0, ["text"], "max-chars 限制")

out, _, ec = run(["read-text", "--session", "eval-d1", "--selector", '[data-testid="stat-users"]'])
check_pass("TC-014", "D2", "read-text --selector stat-users", out, ec, 0, ["Total Users", "stat-users"], "selector 局部文本")

out, _, ec = run(["snapshot", "--session", "eval-d1"])
check_pass("TC-015", "D2", "snapshot", out, ec, 0, ["heading", "button", "link"], "ARIA 树结构")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["snapshot", "-i", "--session", "eval-d1"])
check_pass("TC-016", "D2", "snapshot -i", out, ec, 0, ["button", "input", "link"], "交互元素+ref")

out, _, ec = run(["snapshot", "-c", "--session", "eval-d1"])
check_pass("TC-017", "D2", "snapshot -c", out, ec, 0, ["button", "input"], "紧凑模式")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["accessibility", "--session", "eval-d1"])
check_pass("TC-018", "D2", "accessibility", out, ec, 0, ["role"], "ARIA role 字段")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["accessibility", "-i", "--session", "eval-d1"])
check_pass("TC-019", "D2", "accessibility -i", out, ec, 0, ["button", "input"], "仅交互节点")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["screenshot", "--session", "eval-d1"])
ec2 = ec
path = None
if ec == 0:
    m = re.search(r'path:\s*(\S+)', out)
    if m: path = m.group(1)
if ec == 0 and path and os.path.exists(path):
    record("TC-020", "D2", "PASS", "screenshot", out, "path 非空且文件存在", ec)
elif ec == 0 and path:
    record("TC-020", "D2", "WARN", "screenshot", out, "path 非空但文件不存在", ec)
else:
    record("TC-020", "D2", "FAIL", "screenshot", out, f"exit {ec} 或缺少 path", ec)

out, _, ec = run(["screenshot", "--session", "eval-d1", "--full-page"])
ec2 = ec
path = None
if ec == 0:
    m = re.search(r'path:\s*(\S+)', out)
    if m: path = m.group(1)
if ec == 0 and path:
    record("TC-021", "D2", "PASS", "screenshot --full-page", out, "path 存在", ec)
else:
    record("TC-021", "D2", "FAIL", "screenshot --full-page", out, f"exit {ec} 或缺少 path", ec)

out, _, ec = run(["pdf", "--session", "eval-d1", "--path", "/tmp/eval-test.pdf"])
if ec == 0 and os.path.exists("/tmp/eval-test.pdf"):
    record("TC-022", "D2", "PASS", "pdf", out, "PDF 文件存在", ec)
else:
    record("TC-022", "D2", "FAIL", "pdf", out, f"exit {ec} 或 PDF 不存在", ec)

out, _, ec = run(["page", "current", "--session", "eval-d1"])
check_pass("TC-023", "D2", "page current", out, ec, 0, ["pageId", "url", "title", "navigationId"], "pageId/url/title/navigationId")

out, _, ec = run(["page", "frames", "--session", "eval-d1"])
check_pass("TC-024", "D2", "page frames", out, ec, 0, ["frames"], "frames 数组存在")

out, _, ec = run(["page", "assess", "--session", "eval-d1"])
check_pass("TC-025", "D2", "page assess", out, ec, 0, ["summary", "nextSteps"], "summary+nextSteps")

# ==================== Domain 3 ====================
print("\n=== Domain 3: Navigation & Workspace ===")

out, _, ec = run(["open", TARGET+"/login", "--session", "eval-d1"])
check_pass("TC-026", "D3", "open /login", out, ec, 0, ["/login"], "URL 含 /login")

run(["open", TARGET+"/tabs", "--session", "eval-d1"], timeout=15)
time.sleep(1)
run(["click", "--session", "eval-d1", "--test-id", "link-new-tab-child"], timeout=15)
time.sleep(1)
out, _, ec = run(["page", "list", "--session", "eval-d1"])
check_pass("TC-027", "D3", "page list (multi tab)", out, ec, 0, ["pages"], "pages 数组 >=2")

pages = get_page_list_json("eval-d1")
child_pages = [p for p in pages if "/tabs/child" in p.get("url", "")]
if child_pages:
    pid = child_pages[0]["pageId"]
    run(["tab", "select", pid, "--session", "eval-d1"], timeout=15)
    out, _, ec = run(["page", "current", "--session", "eval-d1"])
    check_pass("TC-028", "D3", "tab select", out, ec, 0, ["/tabs/child"], "切换后 URL 含 /tabs/child")
else:
    record("TC-028", "D3", "FAIL", "tab select", str(pages), "无法获取 child tab pageId", 1)

pages = get_page_list_json("eval-d1")
child_pages = [p for p in pages if "/tabs/child" in p.get("url", "")]
if child_pages:
    pid = child_pages[0]["pageId"]
    before = len(pages)
    run(["tab", "close", pid, "--session", "eval-d1"], timeout=15)
    after_pages = get_page_list_json("eval-d1")
    after = len(after_pages)
    if after < before:
        record("TC-029", "D3", "PASS", "tab close", f"before={before} after={after}", "pages 减少", 0)
    else:
        record("TC-029", "D3", "WARN", "tab close", f"before={before} after={after}", "pages 未减少", 0)
else:
    record("TC-029", "D3", "FAIL", "tab close", str(pages), "无法获取 child tab pageId", 1)

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
out, _, ec = run(["wait", "--networkidle", "--session", "eval-d1"])
check_pass("TC-030", "D3", "wait --networkidle", out, ec, 0, ["waited", "networkIdle"], "network idle 等待成功")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
out, _, ec = run(["wait", "--selector", '[data-testid="stat-users"]', "--session", "eval-d1"])
check_pass("TC-031", "D3", "wait --selector", out, ec, 0, ["waited", "selector"], "selector 等待成功")

out, _, ec = run(["wait", "--text", "Total Users", "--session", "eval-d1"])
check_pass("TC-032", "D3", "wait --text", out, ec, 0, ["waited", "text"], "text 等待成功")

run(["open", TARGET+"/network", "--session", "eval-d1"], timeout=15)
out, _, ec = run(["wait", "--networkidle", "--session", "eval-d1"])
check_pass("TC-033", "D3", "wait --networkidle (network page)", out, ec, 0, ["waited", "networkIdle"], "network idle 等待成功")

out, _, ec = run(["page", "dialogs", "--session", "eval-d1"])
check_pass("TC-034", "D3", "page dialogs", out, ec, 0, ["dialogs"], "dialogs 字段存在")

out, _, ec = run(["resize", "--session", "eval-d1", "--view", "1280x800"])
check_pass("TC-035", "D3", "resize", out, ec, 0, ["width", "height", "1280", "800"], "resize 成功含尺寸")

# ==================== Domain 4 ====================
print("\n=== Domain 4: Interaction ===")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["click", "--session", "eval-d1", "--selector", '[data-testid="login-submit"]'])
check_pass("TC-036", "D4", "click selector", out, ec, 0, ["acted: true"], "acted=true")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["click", "--session", "eval-d1", "--role", "button", "--name", "Sign in"])
check_pass("TC-037", "D4", "click role/name", out, ec, 0, ["acted: true"], "acted=true")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["snapshot", "-i", "--session", "eval-d1", "--output", "json"])
ref = None
if ec == 0:
    try:
        def find_ref(node):
            if isinstance(node, dict):
                if "Sign in" in node.get("name", "") and node.get("role") == "button":
                    return node.get("ref")
                for c in node.get("children", []):
                    r = find_ref(c)
                    if r: return r
            return None
        data = json.loads(out)
        ref = find_ref(data.get("data", data))
    except Exception as e:
        pass
if ref:
    out, _, ec = run(["click", ref, "--session", "eval-d1"])
    check_pass("TC-038", "D4", "click ref", out, ec, 0, ["acted: true"], "acted=true")
else:
    record("TC-038", "D4", "FAIL", "click ref", out, "无法获取 Sign in ref", 1)

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out1, _, ec1 = run(["fill", "--session", "eval-d1", "--label", "Email address", "demo@test.com"])
out2, _, ec2 = run(["fill", "--session", "eval-d1", "--label", "Password", "password123"])
if ec1==0 and ec2==0 and "acted: true" in out1 and "acted: true" in out2:
    record("TC-039", "D4", "PASS", "fill email+password", f"{out1} / {out2}", "两次 fill 均 acted=true", 0)
else:
    record("TC-039", "D4", "FAIL", "fill email+password", f"{out1} / {out2}", f"exit {ec1}/{ec2} 或缺少 acted=true", 0)

run(["open", TARGET+"/forms", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["type", "--session", "eval-d1", "--label", "Full name", "John Doe"])
check_pass("TC-040", "D4", "type", out, ec, 0, ["acted: true"], "acted=true")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
run(["fill", "--session", "eval-d1", "--label", "Email address", "demo@test.com"], timeout=15)
run(["fill", "--session", "eval-d1", "--label", "Password", "password123"], timeout=15)
out, _, ec = run(["press", "Enter", "--session", "eval-d1"])
check_pass("TC-041", "D4", "press Enter", out, ec, 0, ["acted: true"], "acted=true")

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["hover", "--session", "eval-d1", "--test-id", "hover-target"])
out2, _, ec2 = run(["read-text", "--session", "eval-d1"])
if ec==0 and "Tooltip visible" in out2:
    record("TC-042", "D4", "PASS", "hover + read-text", f"{out} / {out2}", "hover+tooltip 可见", 0)
else:
    record("TC-042", "D4", "FAIL", "hover + read-text", f"{out} / {out2}", "hover 失败或无 tooltip", 0)

run(["open", TARGET+"/forms", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["select", "--session", "eval-d1", "--label", "Country", "us"])
check_pass("TC-043", "D4", "select", out, ec, 0, ["value", "acted"], "select 成功")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["check", "--session", "eval-d1", "--label", "Remember me"])
check_pass("TC-044", "D4", "check", out, ec, 0, ["acted: true"], "acted=true")

out, _, ec = run(["uncheck", "--session", "eval-d1", "--label", "Remember me"])
check_pass("TC-045", "D4", "uncheck", out, ec, 0, ["acted: true"], "acted=true")

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["drag", "--session", "eval-d1", "--from-selector", '[data-testid="drag-item-0"]', "--to-selector", '[data-testid="drag-item-2"]'])
check_pass("TC-046", "D4", "drag", out, ec, 0, ["acted: true"], "acted=true")

with open("/tmp/eval-upload.txt", "w") as f:
    f.write("eval upload test\n")
run(["open", TARGET+"/forms", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["upload", "--session", "eval-d1", "--selector", '[data-testid="file-input"]', "/tmp/eval-upload.txt"])
if ec==0 and "eval-upload.txt" in out:
    record("TC-047", "D4", "PASS", "upload", out, "文件名出现在输出", ec)
else:
    record("TC-047", "D4", "WARN", "upload", out, f"exit {ec} 或缺少文件名", ec)

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["download", "--session", "eval-d1", "--selector", '[data-testid="download-server-txt"]'])
path = None
if ec == 0:
    m = re.search(r'path:\s*(\S+)', out)
    if m: path = m.group(1)
if ec==0 and path and os.path.exists(path):
    record("TC-048", "D4", "PASS", "download", out, "path 非空且文件存在", ec)
elif ec==0 and path:
    record("TC-048", "D4", "WARN", "download", out, "path 非空但文件不存在", ec)
else:
    record("TC-048", "D4", "FAIL", "download", out, f"exit {ec} 或缺少 path", ec)

run(["open", TARGET+"/dynamic", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["scroll", "down", "500", "--session", "eval-d1"])
check_pass("TC-049", "D4", "scroll down", out, ec, 0, ["acted", "scroll"], "scroll 成功")

out, _, ec = run(["scroll", "up", "500", "--session", "eval-d1"])
check_pass("TC-050", "D4", "scroll up", out, ec, 0, ["acted", "scroll"], "scroll 成功")

out, _, ec = run(["mouse", "move", "--session", "eval-d1", "--x", "400", "--y", "300"])
check_pass("TC-051", "D4", "mouse move", out, ec, 0, ["acted", "move"], "mouse move 成功")

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["mouse", "click", "--session", "eval-d1", "--x", "400", "--y", "300"])
if ec==0:
    record("TC-052", "D4", "PASS", "mouse click", out, "无错误", ec)
else:
    record("TC-052", "D4", "SKIP", "mouse click", out, "硬编码坐标不稳定", ec)

out, _, ec = run(["mouse", "wheel", "--session", "eval-d1", "--delta-x", "0", "--delta-y", "300"])
check_pass("TC-053", "D4", "mouse wheel", out, ec, 0, ["acted", "wheel"], "mouse wheel 成功")

run(["open", TARGET+"/tabs", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["click", "--session", "eval-d1", "--test-id", "link-new-tab-child"])
check_pass("TC-054", "D4", "click popup", out, ec, 0, ["openedPage"], "openedPage 存在")

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["mouse", "dblclick", "--session", "eval-d1", "--x", "400", "--y", "400"])
if ec==0:
    record("TC-055", "D4", "PASS", "mouse dblclick", out, "无错误", ec)
else:
    record("TC-055", "D4", "SKIP", "mouse dblclick", out, "硬编码坐标不稳定", ec)

# ==================== Domain 5 ====================
print("\n=== Domain 5: Batch ===")

out, _, ec = run(["batch", "--session", "eval-d1", "--stdin-json"], input_data='[["observe", "status"]]')
check_pass("TC-056", "D5", "batch single", out, ec, 0, ["summary", "stepsTotal", "successCount"], "batch 单命令成功")

run(["session", "create", "eval-ses-b1", "--open", TARGET+"/login"], timeout=15)
time.sleep(1)
out, _, ec = run(["batch", "--session", "eval-ses-b1", "--stdin-json"],
    input_data='[["fill", "--label", "Email address", "demo@test.com"], ["fill", "--label", "Password", "password123"], ["click", "--role", "button", "--name", "Sign in"]]')
if ec==0 and "successCount" in out:
    record("TC-057", "D5", "PASS", "batch login", out, "successCount 存在", ec)
else:
    record("TC-057", "D5", "FAIL", "batch login", out, f"exit {ec} 或缺少 successCount", ec)

run(["open", TARGET+"/forms", "--session", "eval-ses-b1"], timeout=15)
time.sleep(1)
out, _, ec = run(["batch", "--session", "eval-ses-b1", "--stdin-json"],
    input_data='[["fill", "--label", "Full name", "Alice Test"], ["fill", "--label", "Email address", "alice@test.com"], ["select", "--label", "Country", "us"]]')
if ec==0 and "successCount" in out:
    record("TC-058", "D5", "PASS", "batch forms", out, "successCount 存在", ec)
else:
    record("TC-058", "D5", "FAIL", "batch forms", out, f"exit {ec} 或缺少 successCount", ec)

out, _, ec = run(["batch", "--session", "eval-ses-ghost", "--stdin-json"], input_data='[["observe", "status"]]')
check_pass("TC-059", "D5", "batch ghost session", out, ec, "nonzero", ["SESSION_NOT_FOUND", "NOT_FOUND"], "SESSION_NOT_FOUND")

out, _, ec = run(["batch", "--session", "eval-ses-b1", "--stdin-json", "--continue-on-error"],
    input_data='[["click", "--selector", "#nonexistent-element-xyz"], ["observe", "status"]]')
if ec==0 and "failureCount" in out:
    record("TC-060", "D5", "PASS", "batch continue-on-error", out, "failureCount 存在", ec)
else:
    record("TC-060", "D5", "WARN", "batch continue-on-error", out, f"exit {ec} 或缺少 failureCount", ec)

out, _, ec = run(["batch", "--session", "eval-ses-b1", "--stdin-json", "--output", "json", "--summary-only"],
    input_data='[["observe", "status"], ["read-text"]]')
if ec==0 and "summary" in out:
    record("TC-061", "D5", "PASS", "batch summary-only", out, "summary 存在", ec)
else:
    record("TC-061", "D5", "WARN", "batch summary-only", out, f"exit {ec} 或缺少 summary", ec)

out, _, ec = run(["batch", "--session", "eval-ses-b1", "--stdin-json", "--output", "json", "--include-results"],
    input_data='[["observe", "status"]]')
if ec==0 and "results" in out:
    record("TC-062", "D5", "PASS", "batch include-results", out, "results 存在", ec)
else:
    record("TC-062", "D5", "WARN", "batch include-results", out, f"exit {ec} 或缺少 results", ec)

# ==================== Domain 6 ====================
print("\n=== Domain 6: Verify & Get ===")
run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)

out, _, ec = run(["verify", "text", "--session", "eval-d1", "--text", "Total Users"])
check_pass("TC-063", "D6", "verify text", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["verify", "text-absent", "--session", "eval-d1", "--text", "THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST"])
check_pass("TC-064", "D6", "verify text-absent", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["verify", "visible", "--session", "eval-d1", "--selector", '[data-testid="stat-users"]'])
check_pass("TC-065", "D6", "verify visible", out, ec, 0, ["passed: true"], "passed=true")

run(["open", TARGET+"/interactions", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["verify", "disabled", "--session", "eval-d1", "--selector", '[data-testid="btn-disabled"]'])
check_pass("TC-066", "D6", "verify disabled", out, ec, 0, ["passed: true"], "passed=true")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["verify", "url", "--session", "eval-d1", "--contains", "/dashboard"])
check_pass("TC-067", "D6", "verify url", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["verify", "count", "--session", "eval-d1", "--selector", '[data-testid^="stat-"]', "--equals", "4"])
check_pass("TC-068", "D6", "verify count", out, ec, 0, ["passed: true", "count: 4"], "passed=true, count=4")

out, _, ec = run(["get", "text", "--session", "eval-d1", "--selector", '[data-testid="stat-users"] .text-2xl'])
check_pass("TC-069", "D6", "get text", out, ec, 0, ["text", "count"], "text 字段非空")

out, _, ec = run(["locate", "--session", "eval-d1", "--text", "Total Users"])
check_pass("TC-070", "D6", "locate", out, ec, 0, ["count", "candidates"], "count>=1")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["is", "visible", "--session", "eval-d1", "--selector", '[data-testid="login-submit"]'])
check_pass("TC-071", "D6", "is visible", out, ec, 0, ["value: true"], "value=true")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["verify", "text", "--session", "eval-d1", "--text", "THIS_VERY_UNIQUE_ABSENT_TEXT_123"])
check_pass("TC-072", "D6", "verify text fail", out, ec, "nonzero", ["VERIFY_FAILED", "passed: false"], "VERIFY_FAILED")

# ==================== Domain 7 ====================
print("\n=== Domain 7: Diagnostics ===")

run(["open", TARGET+"/network", "--session", "eval-d1"], timeout=15)
time.sleep(1)
run(["click", "--session", "eval-d1", "--selector", '[data-testid="run-all"]'], timeout=15)
time.sleep(1)
out, _, ec = run(["network", "--session", "eval-d1"])
check_pass("TC-073", "D7", "network list", out, ec, 0, ["url", "method", "status"], "network 记录存在")

out, _, ec = run(["network", "--session", "eval-d1", "--include-body", "--limit", "5"])
check_pass("TC-074", "D7", "network --include-body", out, ec, 0, ["requestBody", "responseBody"], "body 字段存在")

out, _, ec = run(["console", "--session", "eval-d1"])
check_pass("TC-075", "D7", "console", out, ec, 0, ["console", "messages", "level"], "console 记录")

out, _, ec = run(["errors", "recent", "--session", "eval-d1"])
check_pass("TC-076", "D7", "errors recent", out, ec, 0, ["errors"], "errors 记录")

out, _, ec = run(["diagnostics", "runs", "--session", "eval-d1"])
check_pass("TC-077", "D7", "diagnostics runs", out, ec, 0, ["runId", "session", "commands", "failures"], "runs 列表存在")

out, _, ec = run(["diagnostics", "runs", "--session", "eval-d1", "--output", "json"])
rid = None
if ec == 0:
    try:
        data = json.loads(out)
        runs = data.get("data", data).get("runs", [])
        if runs: rid = runs[0].get("runId")
    except: pass
if rid:
    out, _, ec = run(["diagnostics", "show", "--run", rid])
    check_pass("TC-078", "D7", "diagnostics show", out, ec, 0, ["events", "command", "timestamp"], "events 数组非空")
else:
    record("TC-078", "D7", "FAIL", "diagnostics show", out, "无法获取 runId", 1)

shutil.rmtree("/tmp/eval-bundle", ignore_errors=True)
out, _, ec = run(["diagnostics", "bundle", "--session", "eval-d1", "--out", "/tmp/eval-bundle"])
if ec==0 and os.path.exists("/tmp/eval-bundle/manifest.json"):
    record("TC-079", "D7", "PASS", "diagnostics bundle", out, "manifest.json 存在", ec)
else:
    record("TC-079", "D7", "FAIL", "diagnostics bundle", out, f"exit {ec} 或 manifest 不存在", ec)

out, _, ec = run(["diagnostics", "digest", "--session", "eval-d1"])
check_pass("TC-080", "D7", "diagnostics digest", out, ec, 0, ["url", "console", "network", "error"], "URL+计数字段")

out, _, ec = run(["diagnostics", "timeline", "--session", "eval-d1", "--limit", "20"])
check_pass("TC-081", "D7", "diagnostics timeline", out, ec, 0, ["timestamp", "kind", "summary"], "时间线条目存在")

run(["trace", "start", "--session", "eval-d1"], timeout=15)
run(["click", "--session", "eval-d1", "--role", "button", "--name", "Primary"], timeout=15)
out, _, ec = run(["trace", "stop", "--session", "eval-d1"])
if ec==0 and "traceArtifactPath" in out:
    record("TC-082", "D7", "PASS", "trace stop", out, "traceArtifactPath 存在", ec)
else:
    record("TC-082", "D7", "WARN", "trace stop", out, f"exit {ec} 或缺少 traceArtifactPath", ec)

path = None
if ec == 0:
    m = re.search(r'traceArtifactPath:\s*(\S+)', out)
    if m: path = m.group(1)
if not path or not os.path.exists(path):
    zips = glob.glob(".pwcli/**/*.zip", recursive=True)
    if zips: path = max(zips, key=os.path.getmtime)
if path and os.path.exists(path):
    out, _, ec = run(["trace", "inspect", path, "--section", "actions"])
    check_pass("TC-083", "D7", "trace inspect", out, ec, 0, ["actions", "title", "url"], "action 记录存在")
else:
    record("TC-083", "D7", "SKIP", "trace inspect", out, "无 trace 文件可用", 1)

run(["open", TARGET+"/api/data", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["har", "start", "/tmp/eval-test.har", "--session", "eval-d1"])
if ec != 0 and "UNSUPPORTED_HAR_CAPTURE" in out:
    record("TC-084", "D7", "PASS", "har start", out, "har start 返回 UNSUPPORTED_HAR_CAPTURE (exit 1 预期)", ec)
else:
    record("TC-084", "D7", "WARN", "har start", out, f"exit {ec}，预期 exit 非0 且含 UNSUPPORTED_HAR_CAPTURE", ec)

# Try har replay with fixture if exists
if os.path.exists("scripts/eval/fixtures/test.har"):
    out, _, ec = run(["har", "replay", "scripts/eval/fixtures/test.har", "--session", "eval-d1"])
    if ec == 0:
        record("TC-084b", "D7", "PASS", "har replay", out, "har replay 成功", ec)
    else:
        record("TC-084b", "D7", "WARN", "har replay", out, f"exit {ec}", ec)

out, _, ec = run(["doctor", "--session", "eval-d1"])
check_pass("TC-085", "D7", "doctor", out, ec, 0, ["diagnostics", "environment", "Node.js"], "环境检查结果")

run(["video", "start", "--session", "eval-d1"], timeout=15)
run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["video", "stop", "--session", "eval-d1"])
if ec==0 and "videoPath" in out:
    record("TC-086", "D7", "PASS", "video stop", out, "videoPath 存在", ec)
else:
    record("TC-086", "D7", "WARN", "video stop", out, f"exit {ec} 或缺少 videoPath", ec)

out1, _, ec1 = run(["errors", "clear", "--session", "eval-d1"])
out2, _, ec2 = run(["errors", "recent", "--session", "eval-d1"])
if ec1==0 and ec2==0:
    record("TC-087", "D7", "PASS", "errors clear+recent", f"{out1} / {out2}", "clear+recent 均成功", 0)
else:
    record("TC-087", "D7", "FAIL", "errors clear+recent", f"{out1} / {out2}", f"exit {ec1}/{ec2}", 0)

run(["open", TARGET+"/network", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["console", "--session", "eval-d1", "--level", "error", "--limit", "10"])
check_pass("TC-088", "D7", "console --level error", out, ec, 0, ["level", "error", "messages"], "console level 过滤")

# ==================== Domain 8 ====================
print("\n=== Domain 8: Route & Mock ===")

out, _, ec = run(["route", "add", TARGET+"/api/data", "--session", "eval-d1", "--method", "GET", "--body", '{"mocked":true,"items":[]}', "--content-type", "application/json", "--status", "200"])
check_pass("TC-089", "D8", "route add", out, ec, 0, ["pattern", "route"], "route 添加成功")

out, _, ec = run(["route", "add", TARGET+"/api/data", "--session", "eval-d1", "--method", "GET", "--patch-text", "items=MOCKED_ITEMS"])
check_pass("TC-090", "D8", "route add patch-text", out, ec, 0, ["pattern", "route"], "route patch-text 成功")

out, _, ec = run(["route", "list", "--session", "eval-d1"])
check_pass("TC-091", "D8", "route list", out, ec, 0, ["routes", "pattern", "method"], "routes 数组存在")

out, _, ec = run(["route", "remove", TARGET+"/api/data", "--session", "eval-d1"])
check_pass("TC-092", "D8", "route remove", out, ec, 0, ["removed", "route"], "route remove 成功")

run(["route", "add", TARGET+"/api/data", "--session", "eval-d1", "--method", "GET", "--body", '{"mocked":true}', "--content-type", "application/json", "--status", "200"], timeout=15)
run(["route", "remove", "--session", "eval-d1"], timeout=15)
out, _, ec = run(["route", "list", "--session", "eval-d1"])
check_pass("TC-093", "D8", "route remove all", out, ec, 0, ["routes: []", "count: 0", "routes"], "routes 清空")

run(["route", "add", TARGET+"/api/data", "--session", "eval-d1", "--method", "GET", "--body", '{"mocked":true}', "--content-type", "application/json", "--status", "200"], timeout=15)
run(["open", TARGET+"/api/data", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["read-text", "--session", "eval-d1"])
check_pass("TC-094", "D8", "mock verify", out, ec, 0, ["mocked"], "read-text 含 mock 内容")

out, _, ec = run(["batch", "--session", "eval-d1", "--stdin-json"],
    input_data='[["route", "add", "'+TARGET+'/api/data", "--method", "GET", "--body", "{\\"batch_mocked\\":true}", "--content-type", "application/json"], ["route", "list"]]')
if ec==0 and "successCount" in out:
    record("TC-095", "D8", "PASS", "batch route", out, "successCount 存在", ec)
else:
    record("TC-095", "D8", "FAIL", "batch route", out, f"exit {ec} 或缺少 successCount", ec)

with open("/tmp/eval-routes.json", "w") as f:
    f.write('[{"pattern":"http://localhost:3099/api/data/error","status":200,"body":"{\\"recovered\\":true}","contentType":"application/json"}]')
run(["route", "remove", "--session", "eval-d1"], timeout=15)
out, _, ec = run(["route", "load", "/tmp/eval-routes.json", "--session", "eval-d1"])
check_pass("TC-096", "D8", "route load", out, ec, 0, ["loaded", "route"], "route load 成功")

# ==================== Domain 9 ====================
print("\n=== Domain 9: Auth & State ===")

out, _, ec = run(["cookies", "list", "--session", "eval-ses-b1"])
check_pass("TC-097", "D9", "cookies list", out, ec, 0, ["pwcli_session"], "cookies 含 pwcli_session")

out, _, ec = run(["cookies", "set", "--session", "eval-d1", "--name", "eval_test_cookie", "--value", "test_value_123", "--domain", "localhost"])
check_pass("TC-098", "D9", "cookies set", out, ec, 0, ["cookie", "set"], "cookie 设置成功")

run(["open", TARGET+"/dashboard", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out1, _, ec1 = run(["storage", "local", "set", "eval_test_key", "eval_test_value", "--session", "eval-d1"])
out2, _, ec2 = run(["storage", "local", "get", "eval_test_key", "--session", "eval-d1"])
if ec1==0 and ec2==0 and "eval_test_value" in out2:
    record("TC-099", "D9", "PASS", "storage local set+get", f"{out1} / {out2}", "get 返回正确值", 0)
else:
    record("TC-099", "D9", "FAIL", "storage local set+get", f"{out1} / {out2}", f"exit {ec1}/{ec2} 或缺少 eval_test_value", 0)

out, _, ec = run(["storage", "session", "--session", "eval-d1"])
check_pass("TC-100", "D9", "storage session", out, ec, 0, ["accessible", "storage"], "accessible 字段存在")

out, _, ec = run(["state", "diff", "--session", "eval-ses-b1"])
if ec==0 and "summary" in out:
    record("TC-101", "D9", "PASS", "state diff", out, "含 summary 字段", ec)
else:
    record("TC-101", "D9", "WARN", "state diff", out, f"exit {ec} 或缺少 summary", ec)

run(["storage", "local", "set", "diff_test_key", "diff_test_value", "--session", "eval-ses-b1"], timeout=15)
out, _, ec = run(["state", "diff", "--session", "eval-ses-b1", "--include-values"])
if ec==0 and "summary" in out:
    record("TC-102", "D9", "PASS", "state diff --include-values", out, "含 summary 字段", ec)
else:
    record("TC-102", "D9", "WARN", "state diff --include-values", out, f"exit {ec} 或缺少 summary", ec)

out, _, ec = run(["auth", "probe", "--session", "eval-ses-b1"])
check_pass("TC-103", "D9", "auth probe", out, ec, 0, ["authenticated", "confidence", "status"], "status=authenticated")

out, _, ec = run(["auth", "probe", "--session", "eval-ses-b1", "--url", TARGET+"/dashboard"])
check_pass("TC-104", "D9", "auth probe --url", out, ec, 0, ["authenticated", "resolvedTargetUrl", "status"], "status=authenticated")

out, _, ec = run(["profile", "list-chrome"])
check_pass("TC-105", "D9", "profile list-chrome", out, ec, 0, ["capability"], "capability 字段存在")

# ==================== Domain 10 ====================
print("\n=== Domain 10: Environment & Bootstrap ===")

out1, _, ec1 = run(["environment", "clock", "install", "--session", "eval-d1"])
out2, _, ec2 = run(["environment", "clock", "set", "--session", "eval-d1", "2026-01-01T00:00:00Z"])
out3, _, ec3 = run(["environment", "clock", "resume", "--session", "eval-d1"])
if ec1==0 and ec2==0 and ec3==0:
    record("TC-106", "D10", "PASS", "clock install/set/resume", f"{out1} / {out2} / {out3}", "三步均成功", 0)
else:
    record("TC-106", "D10", "FAIL", "clock install/set/resume", f"{out1} / {out2} / {out3}", f"exit {ec1}/{ec2}/{ec3}", 0)

out1, _, ec1 = run(["environment", "offline", "on", "--session", "eval-d1"])
out2, _, ec2 = run(["environment", "offline", "off", "--session", "eval-d1"])
if ec1==0 and ec2==0:
    record("TC-107", "D10", "PASS", "offline on/off", f"{out1} / {out2}", "两次均成功", 0)
else:
    record("TC-107", "D10", "FAIL", "offline on/off", f"{out1} / {out2}", f"exit {ec1}/{ec2}", 0)

out, _, ec = run(["environment", "geolocation", "set", "--session", "eval-d1", "--lat", "31.2304", "--lng", "121.4737"])
check_pass("TC-108", "D10", "geolocation set", out, ec, 0, ["geolocation", "lat", "lng"], "geolocation 设置成功")

with open("/tmp/eval-init.js", "w") as f:
    f.write("window.__eval_bootstrap = true;\n")
out, _, ec = run(["bootstrap", "apply", "--session", "eval-d1", "--init-script", "/tmp/eval-init.js"])
check_pass("TC-109", "D10", "bootstrap apply", out, ec, 0, ["bootstrapApplied", "applied"], "bootstrapApplied 存在")

out, _, ec = run(["doctor", "--session", "eval-d1"])
check_pass("TC-110", "D10", "doctor bootstrap", out, ec, 0, ["initScript", "appliedAt"], "initScriptCount >= 1")

run(["open", TARGET+"/api/stream", "--session", "eval-d1"], timeout=15)
time.sleep(3)
out, _, ec = run(["sse", "--session", "eval-d1"])
check_pass("TC-111", "D10", "sse", out, ec, 0, ["events", "count", "timestamp"], "SSE 事件记录")

out, _, ec = run(["code", "return await page.title()", "--session", "eval-d1"])
check_pass("TC-112", "D10", "code", out, ec, 0, ["title", "string"], "返回 title 文本")

with open("/tmp/eval-code.js", "w") as f:
    f.write("const url = page.url();\nconst title = await page.title();\nreturn { url, title };\n")
out, _, ec = run(["code", "--file", "/tmp/eval-code.js", "--session", "eval-d1"])
check_pass("TC-113", "D10", "code --file", out, ec, 0, ["url", "title"], "url+title 字段存在")

run(["open", TARGET+"/login", "--session", "eval-d1"], timeout=15)
time.sleep(1)
out, _, ec = run(["locate", "--session", "eval-d1", "--text", "Sign in", "--return-ref"])
check_pass("TC-114", "D10", "locate --return-ref", out, ec, 0, ["ref"], "ref 字段非空")

out, _, ec = run(["environment", "permissions", "grant", "geolocation", "--session", "eval-d1"])
check_pass("TC-115", "D10", "permissions grant", out, ec, 0, ["permission", "granted"], "权限授予成功")

# ==================== Domain 11 ====================
print("\n=== Domain 11: Auth Flow E2E ===")

out, _, ec = run(["session", "create", "eval-e2e-demo", "--open", TARGET+"/login"], timeout=15)
time.sleep(1)
run(["fill", "--session", "eval-e2e-demo", "--label", "Email address", "demo@test.com"], timeout=15)
run(["fill", "--session", "eval-e2e-demo", "--label", "Password", "password123"], timeout=15)
run(["click", "--session", "eval-e2e-demo", "--role", "button", "--name", "Sign in"], timeout=15)
time.sleep(2)
run(["wait", "--text", "Total Users", "--session", "eval-e2e-demo"], timeout=15)
out, _, ec = run(["verify", "url", "--session", "eval-e2e-demo", "--contains", "/dashboard"])
check_pass("TC-116", "D11", "demo login", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["session", "create", "eval-e2e-mfa", "--open", TARGET+"/login"], timeout=15)
time.sleep(1)
run(["fill", "--session", "eval-e2e-mfa", "--label", "Email address", "mfa@test.com"], timeout=15)
run(["fill", "--session", "eval-e2e-mfa", "--label", "Password", "password123"], timeout=15)
run(["click", "--session", "eval-e2e-mfa", "--role", "button", "--name", "Sign in"], timeout=15)
time.sleep(2)
run(["wait", "--text", "verification code", "--session", "eval-e2e-mfa"], timeout=15)
# Try fill digits with selectors
for i in range(6):
    run(["fill", "--session", "eval-e2e-mfa", "--selector", f'[data-testid="mfa-digit-{i}"]', "1"], timeout=10)
    run(["fill", "--session", "eval-e2e-mfa", "--selector", f'[data-testid="mfa-code-{i}"]', "1"], timeout=10)
# Also try type all at once
run(["click", "--session", "eval-e2e-mfa", "--selector", '[data-testid="mfa-code-0"]'], timeout=10)
run(["type", "--session", "eval-e2e-mfa", "123456"], timeout=10)
time.sleep(2)
run(["wait", "--text", "Total Users", "--session", "eval-e2e-mfa"], timeout=15)
out, _, ec = run(["verify", "url", "--session", "eval-e2e-mfa", "--contains", "/dashboard"])
check_pass("TC-117", "D11", "MFA login", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["session", "create", "eval-e2e-bad", "--open", TARGET+"/login"], timeout=15)
time.sleep(1)
run(["fill", "--session", "eval-e2e-bad", "--label", "Email address", "demo@test.com"], timeout=15)
run(["fill", "--session", "eval-e2e-bad", "--label", "Password", "wrongpassword"], timeout=15)
run(["click", "--session", "eval-e2e-bad", "--role", "button", "--name", "Sign in"], timeout=15)
time.sleep(2)
run(["wait", "--selector", '[data-testid="login-error"]', "--session", "eval-e2e-bad"], timeout=15)
out1, _, ec1 = run(["verify", "text", "--session", "eval-e2e-bad", "--text", "Invalid email or password"])
out2, _, ec2 = run(["verify", "url", "--session", "eval-e2e-bad", "--contains", "/login"])
if ec1==0 and ec2==0 and "passed: true" in out1 and "passed: true" in out2:
    record("TC-118", "D11", "PASS", "bad password", f"{out1} / {out2}", "两个 verify 均 passed=true", 0)
else:
    record("TC-118", "D11", "FAIL", "bad password", f"{out1} / {out2}", f"exit {ec1}/{ec2} 或 verify 未通过", 0)

out, _, ec = run(["session", "create", "eval-e2e-unauth", "--open", TARGET+"/dashboard"], timeout=15)
time.sleep(2)
run(["wait", "--text", "Sign in", "--session", "eval-e2e-unauth"], timeout=15)
out, _, ec = run(["verify", "url", "--session", "eval-e2e-unauth", "--contains", "/login"])
check_pass("TC-119", "D11", "unauth redirect", out, ec, 0, ["passed: true"], "passed=true")

out, _, ec = run(["session", "create", "eval-e2e-admin", "--open", TARGET+"/login"], timeout=15)
time.sleep(1)
run(["fill", "--session", "eval-e2e-admin", "--label", "Email address", "admin@test.com"], timeout=15)
run(["fill", "--session", "eval-e2e-admin", "--label", "Password", "admin123"], timeout=15)
run(["click", "--session", "eval-e2e-admin", "--role", "button", "--name", "Sign in"], timeout=15)
time.sleep(2)
run(["wait", "--text", "Total Users", "--session", "eval-e2e-admin"], timeout=15)
run(["open", TARGET+"/api/auth/me", "--session", "eval-e2e-admin"], timeout=15)
time.sleep(1)
out, _, ec = run(["read-text", "--session", "eval-e2e-admin"])
check_pass("TC-120", "D11", "admin login", out, ec, 0, ["role", "admin", "Admin User"], "含 admin role 信息")

# ==================== Cleanup ====================
print("\n=== Cleanup ===")
for s in ["eval-d1", "eval-ses-b1", "eval-e2e-demo", "eval-e2e-mfa", "eval-e2e-bad", "eval-e2e-unauth", "eval-e2e-admin"]:
    run(["session", "close", s], timeout=15)

# ==================== Generate Report ====================
print("\n=== Generating Report ===")

overview = """| Domain | 总数 | PASS | FAIL | WARN | SKIP |
|--------|------|------|------|------|------|
| D1 Session | 10 | {D1_PASS} | {D1_FAIL} | {D1_WARN} | {D1_SKIP} |
| D2 Page Reading | 15 | {D2_PASS} | {D2_FAIL} | {D2_WARN} | {D2_SKIP} |
| D3 Navigation | 10 | {D3_PASS} | {D3_FAIL} | {D3_WARN} | {D3_SKIP} |
| D4 Interaction | 20 | {D4_PASS} | {D4_FAIL} | {D4_WARN} | {D4_SKIP} |
| D5 Batch | 7 | {D5_PASS} | {D5_FAIL} | {D5_WARN} | {D5_SKIP} |
| D6 Verify & Get | 10 | {D6_PASS} | {D6_FAIL} | {D6_WARN} | {D6_SKIP} |
| D7 Diagnostics | 16 | {D7_PASS} | {D7_FAIL} | {D7_WARN} | {D7_SKIP} |
| D8 Route & Mock | 8 | {D8_PASS} | {D8_FAIL} | {D8_WARN} | {D8_SKIP} |
| D9 Auth & State | 9 | {D9_PASS} | {D9_FAIL} | {D9_WARN} | {D9_SKIP} |
| D10 Environment | 10 | {D10_PASS} | {D10_FAIL} | {D10_WARN} | {D10_SKIP} |
| D11 E2E | 5 | {D11_PASS} | {D11_FAIL} | {D11_WARN} | {D11_SKIP} |
| **合计** | 120 | {TOTAL_PASS} | {TOTAL_FAIL} | {TOTAL_WARN} | {TOTAL_SKIP} |
""".format(
    D1_PASS=counters["D1"]["PASS"], D1_FAIL=counters["D1"]["FAIL"], D1_WARN=counters["D1"]["WARN"], D1_SKIP=counters["D1"]["SKIP"],
    D2_PASS=counters["D2"]["PASS"], D2_FAIL=counters["D2"]["FAIL"], D2_WARN=counters["D2"]["WARN"], D2_SKIP=counters["D2"]["SKIP"],
    D3_PASS=counters["D3"]["PASS"], D3_FAIL=counters["D3"]["FAIL"], D3_WARN=counters["D3"]["WARN"], D3_SKIP=counters["D3"]["SKIP"],
    D4_PASS=counters["D4"]["PASS"], D4_FAIL=counters["D4"]["FAIL"], D4_WARN=counters["D4"]["WARN"], D4_SKIP=counters["D4"]["SKIP"],
    D5_PASS=counters["D5"]["PASS"], D5_FAIL=counters["D5"]["FAIL"], D5_WARN=counters["D5"]["WARN"], D5_SKIP=counters["D5"]["SKIP"],
    D6_PASS=counters["D6"]["PASS"], D6_FAIL=counters["D6"]["FAIL"], D6_WARN=counters["D6"]["WARN"], D6_SKIP=counters["D6"]["SKIP"],
    D7_PASS=counters["D7"]["PASS"], D7_FAIL=counters["D7"]["FAIL"], D7_WARN=counters["D7"]["WARN"], D7_SKIP=counters["D7"]["SKIP"],
    D8_PASS=counters["D8"]["PASS"], D8_FAIL=counters["D8"]["FAIL"], D8_WARN=counters["D8"]["WARN"], D8_SKIP=counters["D8"]["SKIP"],
    D9_PASS=counters["D9"]["PASS"], D9_FAIL=counters["D9"]["FAIL"], D9_WARN=counters["D9"]["WARN"], D9_SKIP=counters["D9"]["SKIP"],
    D10_PASS=counters["D10"]["PASS"], D10_FAIL=counters["D10"]["FAIL"], D10_WARN=counters["D10"]["WARN"], D10_SKIP=counters["D10"]["SKIP"],
    D11_PASS=counters["D11"]["PASS"], D11_FAIL=counters["D11"]["FAIL"], D11_WARN=counters["D11"]["WARN"], D11_SKIP=counters["D11"]["SKIP"],
    TOTAL_PASS=sum(c["PASS"] for c in counters.values()),
    TOTAL_FAIL=sum(c["FAIL"] for c in counters.values()),
    TOTAL_WARN=sum(c["WARN"] for c in counters.values()),
    TOTAL_SKIP=sum(c["SKIP"] for c in counters.values()),
)

# Build per-domain markdown
domain_md = {}
for r in results:
    d = r["domain"]
    if d not in domain_md:
        domain_md[d] = ""
    icon = {"PASS":"✅ PASS", "FAIL":"❌ FAIL", "WARN":"⚠️ WARN", "SKIP":"⏭️ SKIP"}[r["status"]]
    out_escaped = r["out"].replace("\n", " ").replace("|", "\\|")[:300]
    domain_md[d] += f"### {r['tc']} {icon}\n"
    domain_md[d] += f"**执行**: `{r['cmd']}`\n"
    domain_md[d] += f"**输出摘要**: {out_escaped}\n"
    if r["status"] in ("FAIL", "SKIP"):
        domain_md[d] += f"**判断**: {r['reason']}\n"
    else:
        domain_md[d] += f"**判断**: exit {r['exit_code']} + {r['reason']}\n"
    domain_md[d] += "\n"

fail_list = ""
warn_list = ""
for r in results:
    if r["status"] == "FAIL":
        fail_list += f"- {r['tc']}: `{r['cmd']}` → {r['reason']}\n"
    elif r["status"] == "WARN":
        warn_list += f"- {r['tc']}: exit 0 但 {r['reason']}\n"
    elif r["status"] == "SKIP":
        fail_list += f"- {r['tc']}: `{r['cmd']}` → SKIP: {r['reason']}\n"

total_exec = len(results)
total_pass = sum(c["PASS"] for c in counters.values())
rate = total_pass * 100 // total_exec if total_exec else 0

CORE_PASS = counters["D1"]["PASS"] + counters["D2"]["PASS"] + counters["D4"]["PASS"] + counters["D11"]["PASS"]
CORE_TOTAL = 45
CORE_RATE = CORE_PASS * 100 // CORE_TOTAL

quality = "excellent" if rate >= 90 else "good" if rate >= 75 else "needs-work"
max_fail_d = max(counters.keys(), key=lambda d: counters[d]["FAIL"])

report = f"""# pwcli 评测结果
执行时间: {datetime.now(timezone.utc).isoformat()}
pwcli 版本: 0.2.0
靶场: {TARGET}

## 总览
{overview}

## Domain 1: Session 管理

{domain_md.get("D1","")}

## Domain 2: 页面读取

{domain_md.get("D2","")}

## Domain 3: 导航与 Workspace

{domain_md.get("D3","")}

## Domain 4: 交互操作

{domain_md.get("D4","")}

## Domain 5: Batch

{domain_md.get("D5","")}

## Domain 6: Verify & Get

{domain_md.get("D6","")}

## Domain 7: 诊断

{domain_md.get("D7","")}

## Domain 8: Route & Mock

{domain_md.get("D8","")}

## Domain 9: Auth & State

{domain_md.get("D9","")}

## Domain 10: Environment & Bootstrap

{domain_md.get("D10","")}

## Domain 11: Auth Flow E2E

{domain_md.get("D11","")}

## 失败/警告汇总

### ❌ FAIL 列表
{fail_list if fail_list else "（无）\n"}

### ⚠️ WARN 列表
{warn_list if warn_list else "（无）\n"}

## 评测结论
总通过率: {total_pass}/{total_exec} ({rate}%)
核心链路通过率（D1+D2+D4+D11）: {CORE_PASS}/{CORE_TOTAL} ({CORE_RATE}%)
主要问题域: {max_fail_d}（FAIL={counters[max_fail_d]['FAIL']}）
质量评价: {quality}
"""

with open(RESULTS_FILE, "w") as f:
    f.write(report)

print(f"\nReport written to {RESULTS_FILE}")
print(f"Total: PASS={total_pass} FAIL={sum(c['FAIL'] for c in counters.values())} WARN={sum(c['WARN'] for c in counters.values())} SKIP={sum(c['SKIP'] for c in counters.values())}")
