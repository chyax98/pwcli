#!/usr/bin/env bash
# pwcli Agent Benchmark — 单任务运行器
# 用法: ./run_task.sh <task_id>
#   ./run_task.sh T01

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_ID="${1:?用法: $0 <task_id>}"
TASK_FILE="$SCRIPT_DIR/tasks/${TASK_ID}-*.md"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$RESULTS_DIR/${TASK_ID}_${TIMESTAMP}.md"

mkdir -p "$RESULTS_DIR"

# 找到任务文件
TASK_FILE=$(ls $SCRIPT_DIR/tasks/${TASK_ID}-*.md 2>/dev/null | head -1)
if [[ -z "$TASK_FILE" ]]; then
  echo "错误: 找不到任务文件 ${TASK_ID}-*.md"
  exit 1
fi

echo "▶ 运行任务: $TASK_ID"
echo "  任务文件: $TASK_FILE"
echo "  结果输出: $RESULT_FILE"
echo ""

# 构造发给 Kimi 的完整 prompt
TASK_CONTENT=$(cat "$TASK_FILE")
PW_PATH="node /Users/xd/work/tools/pwcli/dist/cli.js"
APP_URL="http://localhost:3099"

PROMPT="你是一个 AI Agent，使用 pwcli 浏览器工具完成用户给你的任务。

## 工具说明
- pw 命令路径: $PW_PATH（已别名为 pw）
- 靶场地址: $APP_URL
- 工作目录: /Users/xd/work/tools/pwcli

## 你的任务
$TASK_CONTENT

## 执行要求
1. **自主决策**：根据任务需求，自主选择使用哪些 pw 命令，不要询问
2. **自主恢复**：遇到失败，分析原因，自主重试或调整策略
3. **产出证据**：按任务要求产出截图、输出等证据
4. **结构化输出**：执行结束后，按以下格式输出结果

## 输出格式（执行结束后必须输出）
在最终输出的末尾，输出如下结构（每行一条，保持精确格式）：
\`\`\`
TASK_RESULT_START
TASK_ID: $TASK_ID
TASK_COMPLETE: true/false
CRITERIA_C1: PASS/FAIL
CRITERIA_C2: PASS/FAIL
CRITERIA_C3: PASS/FAIL
CRITERIA_C4: PASS/FAIL
CRITERIA_C5: PASS/FAIL  (如有)
CRITERIA_C6: PASS/FAIL  (如有)
COMMANDS_USED: <pw 命令总数>
ARTIFACTS: <artifact 路径，逗号分隔，无则写 none>
ERROR_CODES: <遇到的错误码，无则写 none>
RECOVERY_COUNT: <自主恢复次数>
NOTES: <简短说明>
TASK_RESULT_END
\`\`\`

## 重要约束
- session 名必须以 bench- 开头（任务文件中有指定名称）
- 任务结束后关闭 session
- 不要修改 pwcli 的源代码
- 遇到 UNSUPPORTED_HAR_CAPTURE 错误属于预期，跳过 har start/stop，改用 har replay
- wait 命令使用 --networkidle 或 --selector 或 --text，不要用 --url 或数字 delay
"

# 用 kimi 执行
START_TIME=$(date +%s)

kimi --quiet -w /Users/xd/work/tools/pwcli -p "$PROMPT" > "$RESULT_FILE" 2>&1
EXIT_CODE=$?

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "任务完成（exit: $EXIT_CODE，耗时: ${ELAPSED}s）"
echo "结果文件: $RESULT_FILE"
echo ""

# 提取结构化结果
if grep -q "TASK_RESULT_START" "$RESULT_FILE" 2>/dev/null; then
  echo "=== 结构化结果 ==="
  sed -n '/TASK_RESULT_START/,/TASK_RESULT_END/p' "$RESULT_FILE"
  echo ""

  # 计算通过率
  TOTAL_CRITERIA=$(grep -c "^CRITERIA_C[0-9]*: " <(sed -n '/TASK_RESULT_START/,/TASK_RESULT_END/p' "$RESULT_FILE") 2>/dev/null || echo 0)
  PASS_CRITERIA=$(grep -c "^CRITERIA_C[0-9]*: PASS" <(sed -n '/TASK_RESULT_START/,/TASK_RESULT_END/p' "$RESULT_FILE") 2>/dev/null || echo 0)
  COMPLETE=$(grep "^TASK_COMPLETE:" "$RESULT_FILE" | tail -1 | awk '{print $2}')

  echo "成功标准通过: $PASS_CRITERIA / $TOTAL_CRITERIA"
  echo "任务完成: $COMPLETE"
else
  echo "⚠️  未找到结构化结果，Agent 可能未按格式输出"
fi

# 把耗时写入结果文件
echo "" >> "$RESULT_FILE"
echo "---" >> "$RESULT_FILE"
echo "RUNNER_TIME_S: $ELAPSED" >> "$RESULT_FILE"
echo "RUNNER_EXIT: $EXIT_CODE" >> "$RESULT_FILE"
