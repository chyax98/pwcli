# 页面探索参考

主流程以 `SKILL.md` 为准。本文件只做展开参考。

## 新任务

新 URL、新系统、新登录态，创建新 session：

```bash
pw session create <name> --headed --open '<url>'
```

无头自动化：

```bash
pw session create <name> --headless --open '<url>'
```

## 继续旧任务

用户明确说继续刚才页面时，才检查并复用 session：

```bash
pw session list --with-page
pw observe status --session <name>
pw page current --session <name>
pw read-text --session <name> --max-chars 2000
```

## 观察

```bash
pw observe status --session <name>
pw page current --session <name>
pw read-text --session <name> --max-chars 2000
```

需要 aria ref：

```bash
pw snapshot --session <name>
```

## 动作

```bash
pw click --session <name> --selector '<selector>'
pw fill --session <name> --selector '<selector>' '<value>'
pw click --session <name> --role button --name '<name>'
pw click --session <name> --text '<text>'
pw click --session <name> e42
```

动作后等待：

```bash
pw wait --session <name> network-idle
pw wait --session <name> --text '<visible text>'
pw wait --session <name> --selector '<selector>'
```

## 复查

```bash
pw read-text --session <name> --max-chars 2000
pw diagnostics digest --session <name>
```

如果出现错误、白屏、接口失败，按 `SKILL.md` 的 Bug 诊断流程继续。
