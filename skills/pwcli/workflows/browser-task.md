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
pw observe status -s <name>
pw page current -s <name>
pw read-text -s <name> --max-chars 2000
```

## 观察

```bash
pw observe status -s <name>
pw page current -s <name>
pw read-text -s <name> --max-chars 2000
```

如果页面很大，先 scoped，再 compact，不要直接全量 snapshot：

```bash
pw read-text -s <name> --selector '<main-or-panel>' --max-chars 2000
pw locate -s <name> --text '<visible text>'
pw snapshot -i -s <name>
pw snapshot -c -s <name>
```

只有 scoped / interactive / compact 不足以回答问题时，才使用全量 `pw snapshot -s <name>`。如果当前命令面暴露 depth 参数，先用 depth 限制层级。

多页面、popup、新开预览页：

```bash
pw page list -s <name>
pw tab select <pageId> -s <name>
pw tab close <pageId> -s <name>
```

`tab select|close` 的目标只用 `pageId`。`page list` 里的 index、title、URL 只用于读侧判断。

需要 aria ref：

```bash
pw snapshot -i -s <name>
```

## 动作

```bash
pw click -s <name> --selector '<selector>'
pw fill -s <name> --selector '<selector>' '<value>'
pw click -s <name> --role button --name '<name>'
pw click -s <name> --text '<text>'
pw click e42 -s <name>
pw hover -s <name> --selector '<selector>'
```

动作后等待：

```bash
pw wait network-idle -s <name>
pw wait -s <name> --text '<visible text>'
pw wait -s <name> --selector '<selector>'
```

## 复查

```bash
pw read-text -s <name> --max-chars 2000
pw diagnostics digest -s <name>
```

如果 `read-text` 已经确认页面内容可读，console/network 里的第三方 warning、favicon 404、扩展噪声只作为背景。只有内容缺失、动作失败、白屏、接口 4xx/5xx 或 page error 影响目标路径时，才进入 diagnostics 主流程。
