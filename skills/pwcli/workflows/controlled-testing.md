# 可控测试参考

主流程以 `SKILL.md` 为准。本文件补充 route、environment、bootstrap 的组合用法。

边界：

```text
route/mock 只为真实 controlled-testing、diagnostics、extraction 复现场景服务
不是通用 mocking 平台
```

## Mock

固定响应：

```bash
pw route add '**/api/**' --session <name> --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw route list --session <name>
```

请求体匹配：

```bash
pw route add '**/api/**' --session <name> --method POST --match-body '<substring>' --status 200 --content-type application/json --body '{"ok":true}'
```

Patch upstream JSON：

```bash
pw route add '**/api/**' --session <name> --patch-json-file ./patch.json --patch-status 298
```

多条 route：

```bash
printf '%s\n' '[["route","add","**/api/a","--status","200","--body","{\"ok\":true}"],["route","add","**/api/b","--status","204"]]' \
  | pw batch --session <name> --stdin-json
```

清理：

```bash
pw route remove '**/api/**' --session <name>
pw route remove --session <name>
```

## Environment

```bash
pw environment offline on --session <name>
pw environment offline off --session <name>
pw environment geolocation set --session <name> --lat 37.7749 --lng -122.4194
pw environment permissions grant geolocation clipboard-read --session <name>
pw environment permissions clear --session <name>
pw environment clock install --session <name>
pw environment clock set --session <name> 2024-12-10T10:00:00.000Z
pw environment clock resume --session <name>
```

## Bootstrap

```bash
pw bootstrap apply --session <name> --init-script ./bootstrap.js
pw bootstrap apply --session <name> --headers-file ./headers.json
```

## 组合模板

```bash
pw session create test-a --no-headed --open '<url>'
pw route add '**/api/**' --session test-a --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw environment permissions grant geolocation --session test-a
pw bootstrap apply --session test-a --init-script ./bootstrap.js
pw click --session test-a --selector '<selector>'
pw wait --session test-a --text '<expected>'
pw --output json read-text --session test-a --max-chars 1000
```
