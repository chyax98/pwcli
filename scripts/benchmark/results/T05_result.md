# T05 文件上传与下载验证

## 执行摘要

TASK_RESULT_START
TASK_ID: T05
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
COMMANDS_USED: 14
ARTIFACTS: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-33-715Z-bench-t05/download.txt,/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-51-606Z-bench-t05/screenshot-1777801611607.png
ERROR_CODES: none
RECOVERY_COUNT: 0
NOTES: upload/download 均 exit 0，uploaded-files 区域验证到 bench-upload.txt，download.txt 已落盘（387 bytes）
TASK_RESULT_END

## 执行详情

### 环境
- Session: bench-t05
- 靶场: http://localhost:3099
- 执行时间: 2026-05-03

### 步骤记录

| 步骤 | 命令 | 结果 |
|------|------|------|
| 1 | session create bench-t05 | created=true, trace enabled |
| 2 | open /login | navigated=true |
| 3 | fill email (ref e17) | filled=true |
| 4 | fill password (ref e21) | filled=true |
| 5 | click sign-in (ref e29) | acted=true, /dashboard |
| 6 | node -e writeFileSync /tmp/bench-upload.txt | file created (20 bytes) |
| 7 | open /forms | navigated=true |
| 8 | upload --selector [data-testid=file-input] /tmp/bench-upload.txt | uploaded=true |
| 9 | read-text --selector [data-testid=uploaded-files] | "bench-upload.txt" (16 chars) |
| 10 | open /interactions | navigated=true |
| 11 | download --selector [data-testid=download-server-txt] --output json | downloaded=true, savedAs=.../download.txt |
| 12 | ls -la download path | 387 bytes, exists |
| 13 | screenshot | captured=true |
| 14 | session close bench-t05 | closed=true |

### C1: Upload 验证
- `pw upload` exit 0, uploaded=true
- read-text 返回: `bench-upload.txt`
- 验证区域: `[data-testid=uploaded-files]`
- **结论: PASS**

### C2: Download path 非空
- download JSON 输出: `savedAs=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-33-715Z-bench-t05/download.txt`
- suggestedFilename: `download.txt`
- sourcePath: `/Users/xd/work/tools/pwcli/.pwcli/playwright/download.txt`
- **结论: PASS**

### C3: 文件存在于磁盘
- `ls -la` 确认文件存在，大小 387 bytes
- 路径: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-33-715Z-bench-t05/download.txt`
- 注: pw code 不支持 require()（ESM 环境）和动态 import()，改用 Bash ls 命令直接验证
- **结论: PASS**

### C4: Screenshot 留证
- 路径: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-51-606Z-bench-t05/screenshot-1777801611607.png`
- captured=true
- **结论: PASS**

### 异常记录
- `pw code` 在 sandbox 环境中不支持 `require()` 或动态 `import()`，改用 Bash ls 命令验证文件存在性，功能等效
- login 使用 snapshot ref 而非 data-testid（form fields 无 data-testid，用 e17/e21/e29 ref 替代）
