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

多页面、popup、新开预览页：

```bash
pw page list -s <name>
pw tab select <pageId> -s <name>
pw tab close <pageId> -s <name>
```

`tab select|close` 的目标只用 `pageId`。`page list` 里的 index、title、URL 只用于读侧判断。

需要 aria ref：

```bash
pw snapshot -s <name>
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

如果出现错误、白屏、接口失败，按 `SKILL.md` 的 Bug 诊断流程继续。
