# Workflows

本文件只写跨命令任务链路。单个命令参数查当前 CLI：

```bash
pw <command> --help
```

## 页面探索

```bash
pw session create task-a --headed --open '<url>'
pw status -s task-a
pw read-text -s task-a --max-chars 2000
pw snapshot -i -s task-a
```

## 动作闭环

```bash
pw click -s task-a --text '<target>'
pw wait network-idle -s task-a
pw verify text -s task-a --text '<expected>'
pw read-text -s task-a --max-chars 1200
```

## Bug 复现

```bash
pw session create bug-a --headed --open '<url>'
pw errors clear -s bug-a
pw read-text -s bug-a --max-chars 2000
pw <action-command> -s bug-a ...
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 500 --limit 20
pw errors recent -s bug-a --limit 20
```

## 证据交接

```bash
pw diagnostics bundle -s bug-a --out .pwcli/bundles/<task> --task '<task>'
```

交接报告至少写：

- session 名
- 当前 URL 和标题
- 复现动作
- 断言结果
- console/network/errors 摘要
- bundle 路径

## 受控测试

```bash
pw route add -s test-a '<pattern>' --fulfill-json '{"ok":true}'
pw open -s test-a '<url>'
pw wait network-idle -s test-a
pw verify text -s test-a --text '<expected>'
```

只 mock 当前任务需要的最小接口。mock 后必须验证命中。

## Auth

```bash
pw session create auth-a --headed
pw auth list
pw auth info <provider>
pw auth <provider> -s auth-a
pw read-text -s auth-a --max-chars 1200
pw auth probe -s auth-a
```

DC 见 `dc-auth.md`。
