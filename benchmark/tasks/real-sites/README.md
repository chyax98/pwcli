# Real-site Benchmark Pack

这里放人工 dogfood 的真实站点稳定性检查，不进入日常 deterministic closure suite，也不是自动化 CI gate。

## 目标

- 验证 `pwcli` 在真实页面上的上限
- 补 deterministic fixture 看不到的问题：
  - 真实登录态
  - 复杂 DOM
  - 虚拟列表
  - 真实导航/重定向
  - 真实 anti-bot / handoff 边界

## 当前 manual pack

### 1. GitHub Issues / Pull Requests

测：

- `page assess`
- `read-text`
- `snapshot -i`
- `auth probe`（如果使用登录态）

成功标准：

- 可稳定读取标题、正文、评论或列表项文本
- 登录态存在时，`auth probe` 不误判

推荐命令链：

```bash
pw session create gh-a --open 'https://github.com/chyax98/pwcli/pull/68'
pw page assess --session gh-a
pw read-text --session gh-a --max-chars 3000
pw snapshot -i --session gh-a
pw diagnostics digest --session gh-a
```

最小 artifact checklist：

- one screenshot
- diagnostics digest
- failure notes

### 2. Hacker News

测：

- 只读结构提取
- 链接列表可见内容读取
- diagnostics 轻量证据链

成功标准：

- 能稳定读取标题、链接、分数/作者等可见字段

推荐命令链：

```bash
pw session create hn-a --open 'https://news.ycombinator.com/'
pw page assess --session hn-a
pw read-text --session hn-a --max-chars 3000
pw snapshot -i --session hn-a
pw diagnostics digest --session hn-a
```

### 3. Wikipedia

测：

- 长文档 perception
- `page assess` 与 `read-text` 的分工

成功标准：

- 可稳定识别主标题、导语、正文片段

推荐命令链：

```bash
pw session create wiki-a --open 'https://en.wikipedia.org/wiki/Playwright_(software)'
pw page assess --session wiki-a
pw read-text --session wiki-a --max-chars 3000
pw snapshot -i --session wiki-a
pw diagnostics digest --session wiki-a
```

### 4. 一个内部后台 / CMS

测：

- 登录态复用
- `auth probe`
- `state diff`
- 表格/列表可见内容读取

成功标准：

- 登录态复用成立
- 可稳定读取表格首屏内容
- 失败时有 diagnostics 证据链

## 运行原则

- 不把真实站点混入 closure suite
- 不把真实站点波动包装成 deterministic 回归失败
- 登录、2FA、挑战页允许人工接管
- 不以绕过风控为目标
- 真实站点只回答“当前页面观察 / 诊断主链是否够用”，不要顺手补抽象

## 推荐命令链

```bash
pw session create real-a --open '<url>'
pw page assess --session real-a
pw auth probe --session real-a
pw read-text --session real-a --max-chars 3000
pw snapshot -i --session real-a
pw diagnostics digest --session real-a
```
