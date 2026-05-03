# T05: 文件上传与下载验证

## 用户需求
帮我测试应用的文件上传和下载功能：上传一个测试文件，然后下载一个服务端文件，告诉我两个操作的结果。

## 上下文
- 应用地址: http://localhost:3099
- 登录账号: demo@test.com / password123
- 上传页面: /forms，上传组件 testid: file-input，上传区域: file-drop-zone
- 下载页面: /interactions，下载按钮 testid: download-server-txt
- 上传后文件名显示区: uploaded-files
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t05

## 成功标准
- [ ] C1: 上传 /tmp/bench-upload.txt（先用 pw code 创建这个文件）
- [ ] C2: 上传后页面显示文件名（uploaded-files 区域有内容）
- [ ] C3: download download-server-txt 成功，返回 path 字段
- [ ] C4: 下载的文件存在于磁盘（path 非空）

## 证据要求
- 上传成功后截图
- download 命令输出（含 path 字段）

## 约束
- 先创建上传文件: 用 pw code 执行 `require('fs').writeFileSync('/tmp/bench-upload.txt', 'benchmark test')`
- session 完成后关闭
