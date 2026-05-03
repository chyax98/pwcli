#!/usr/bin/env bash
# pwcli Agent Benchmark — 全量运行器
# 用法: ./run_all.sh [--core] [--parallel N]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$RESULTS_DIR/benchmark_report_$TIMESTAMP.md"
CORE_ONLY=false
PARALLEL=1

# 参数解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --core) CORE_ONLY=true ;;
    --parallel) PARALLEL="${2:-1}"; shift ;;
  esac
  shift
done

CORE_TASKS=(T01 T02 T04 T06)
ALL_TASKS=(T01 T02 T03 T04 T05 T06 T07 T08 T09 T10)

if $CORE_ONLY; then
  TASKS=("${CORE_TASKS[@]}")
else
  TASKS=("${ALL_TASKS[@]}")
fi

mkdir -p "$RESULTS_DIR"

# 环境检查
echo "pwcli Agent Benchmark"
echo "时间: $(date)"
echo "场景: ${TASKS[*]}"
echo ""

python3 -c "
import urllib.request, urllib.error, sys
try:
    urllib.request.urlopen('http://localhost:3099/api/auth/me')
except urllib.error.HTTPError as e:
    if e.code == 401: print('靶场: ✅ 运行中'); sys.exit(0)
    print('靶场: ❌ 异常状态'); sys.exit(1)
except Exception as e:
    print(f'靶场: ❌ 未运行 ({e})'); sys.exit(1)
"

echo ""

# 运行所有任务
declare -A RESULTS
for task in "${TASKS[@]}"; do
  echo "────────────────────────────────"
  bash "$SCRIPT_DIR/run_task.sh" "$task" 2>&1
  RESULTS[$task]="$RESULTS_DIR/${task}_*.md"
done

# 生成聚合报告
echo ""
echo "════════════════════════════════"
echo "生成 Benchmark 报告..."

python3 - "$RESULTS_DIR" "$TIMESTAMP" "$REPORT" "${TASKS[@]}" << 'PYEOF'
import sys, os, glob, re

results_dir = sys.argv[1]
timestamp = sys.argv[2]
report_path = sys.argv[3]
tasks = sys.argv[4:]

rows = []
total_pass = 0
total_fail = 0
total_criteria_pass = 0
total_criteria_total = 0
total_time = 0
all_artifacts = []

for task_id in tasks:
    pattern = os.path.join(results_dir, f"{task_id}_*.md")
    files = sorted(glob.glob(pattern))
    if not files:
        rows.append({"id": task_id, "status": "SKIP", "criteria": "—", "time": "—", "artifacts": "—"})
        continue

    content = open(files[-1]).read()

    # 提取结构化结果
    block = ""
    m = re.search(r'TASK_RESULT_START(.*?)TASK_RESULT_END', content, re.DOTALL)
    if m:
        block = m.group(1)

    complete = "true" in re.findall(r'TASK_COMPLETE:\s*(\S+)', block)
    criteria_pass = len(re.findall(r'CRITERIA_C\d+:\s*PASS', block))
    criteria_total = len(re.findall(r'CRITERIA_C\d+:', block))
    commands = next(iter(re.findall(r'COMMANDS_USED:\s*(\d+)', block)), "?")
    artifacts = next(iter(re.findall(r'ARTIFACTS:\s*(.+)', block)), "none").strip()
    notes = next(iter(re.findall(r'NOTES:\s*(.+)', block)), "").strip()[:50]
    time_m = re.search(r'RUNNER_TIME_S:\s*(\d+)', content)
    time_s = int(time_m.group(1)) if time_m else 0

    if complete:
        total_pass += 1
        status = "✅ PASS"
    elif block:
        total_fail += 1
        status = "❌ FAIL"
    else:
        status = "⚠️  WARN"

    total_criteria_pass += criteria_pass
    total_criteria_total += criteria_total
    total_time += time_s
    if artifacts != "none":
        all_artifacts.extend(artifacts.split(","))

    rows.append({
        "id": task_id,
        "status": status,
        "criteria": f"{criteria_pass}/{criteria_total}",
        "commands": commands,
        "time": f"{time_s}s",
        "artifacts": "✅" if artifacts != "none" else "—",
        "notes": notes,
    })

total = len(tasks)
pass_rate = f"{total_pass/total*100:.0f}%" if total else "0%"
core_tasks = ["T01","T02","T04","T06"]
core_pass = sum(1 for r in rows if r["id"] in core_tasks and "PASS" in r["status"])
core_rate = f"{core_pass/len(core_tasks)*100:.0f}%" if core_tasks else "0%"
criteria_rate = f"{total_criteria_pass/total_criteria_total*100:.0f}%" if total_criteria_total else "0%"
avg_time = f"{total_time/total:.0f}s" if total else "0s"

with open(report_path, "w") as f:
    f.write(f"""# pwcli Agent Benchmark Report

**时间**: {timestamp}
**场景数**: {total}

## 聚合指标

| 指标 | 值 | 目标 |
|------|-----|------|
| 场景通过率 | {pass_rate} | ≥ 80% |
| Core 场景通过率 | {core_rate} | ≥ 90% |
| 成功标准通过率 | {criteria_rate} | ≥ 85% |
| 平均耗时 | {avg_time} | ≤ 60s |
| 证据产出场景数 | {len([r for r in rows if r.get("artifacts")=="✅"])}/{total} | — |

## 场景明细

| 场景 | 结果 | 标准通过 | 命令数 | 耗时 | 证据 |
|------|------|----------|--------|------|------|
""")
    for r in rows:
        f.write(f"| {r['id']} | {r['status']} | {r.get('criteria','—')} | {r.get('commands','—')} | {r['time']} | {r.get('artifacts','—')} |\n")

    f.write(f"""
## 总结

- 通过: {total_pass}/{total} 场景
- 失败: {total_fail}/{total} 场景
- 成功标准: {total_criteria_pass}/{total_criteria_total}
""")

print(f"报告已生成: {report_path}")
print(f"场景通过率: {pass_rate}")
print(f"Core 通过率: {core_rate}")
print(f"成功标准通过率: {criteria_rate}")
PYEOF
