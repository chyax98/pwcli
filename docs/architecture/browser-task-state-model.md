# Browser Task State Model

更新时间：2026-04-28
状态：analysis

这份文档只定义 `pwcli` 面向 Agent 浏览器任务的认知域和目标场景。

它属于分析文档，不承诺新命令，不描述当前已支持能力。

## 1. 背景

`pwcli` 已经有较完整的 Playwright primitive：

- session lifecycle
- workspace projection
- interaction
- diagnostics
- mock
- environment
- auth / state reuse
- code execution lane

继续堆单点命令的收益开始下降。真正的问题在于 Agent 执行浏览器任务时缺少统一的状态认知。

Agent 需要的不止是“点击按钮”的能力，还需要持续回答：

1. 当前浏览器任务状态是什么？
2. 当前意图该推进哪一步？
3. 执行操作后状态发生了什么变化？
4. 变化是否符合意图？
5. 失败时该恢复、等待、换目标、诊断，还是导出证据？

所以 `pwcli` 的高阶方向不应只描述为 browser automation CLI，而应描述为：

```text
Browser Task State substrate for Agents
```

## 2. 目标场景

### 2.1 Task Agent

用户交给 Agent 一个真实浏览器任务：

- 打开页面
- 准备或复用登录态
- 理解当前页面
- 找到目标元素
- 填写、点击、上传、下载
- 判断任务是否完成
- 失败时恢复
- 留下证据

典型链路：

```text
prepare -> locate -> act -> wait -> verify -> recover -> evidence
```

### 2.2 Debug Agent

用户让 Agent 复现、定位、验证一个页面问题：

- 执行动作
- 观察请求、console、runtime error
- 使用 mock 改变后端响应
- 重新执行
- 判断 bug 是否复现或修复
- 导出可交接证据

典型链路：

```text
action -> diagnosticsDelta -> digest -> export -> mock -> rerun
```

### 2.3 Test Agent

用户希望把真实浏览器操作沉淀成回归验证：

- 用语义目标定位元素
- 执行动作
- 判断 expected transition
- 失败时输出可复现证据
- 把稳定模式保留为测试资产

典型链路：

```text
semantic target -> action -> expected transition -> artifact -> replayable failure
```

### 2.4 非主线场景

用户浏览器接管、extension relay、native host、raw CDP substrate 仍然有价值，但属于产品形态升级。

当前主线只吸收它们的一个思想：浏览器任务需要可观察、可交接、可恢复的状态记录。

## 3. 核心矛盾

### 3.1 完整脚本不可预写

Agent 无法提前知道下一页状态。

以下状态都只能运行时确认：

- 登录后跳转到哪里
- 是否出现弹窗
- 按钮是否 disabled
- 请求是否 pending 或失败
- 是否打开新 tab
- 文案是否变化
- 表单校验如何反馈
- 登录态是否过期

所以一次性预写完整 Playwright workflow 不稳定。

### 3.2 裸命令链缺少状态推理

`snapshot -> click -> wait -> diagnostics` 可以执行，但状态分散。

Agent 仍要自己拼：

- 刚才是否点对了？
- 页面有没有变化？
- 是成功、失败、无变化、阻塞，还是还在等待？
- 下一步应该 wait、locate、doctor、digest、mock，还是 export？

### 3.3 `ref` 和 selector 只能短命

snapshot ref 只在当前页面状态下可靠。页面重渲染、列表排序、tab 切换、虚拟列表和异步更新都会让它失效。

长期资产不能保存：

```json
["click", "e42"]
```

长期资产只能保存语义目标和预期转移：

```json
{
  "intent": "submit form",
  "target": { "role": "button", "name": "提交" },
  "expect": [
    { "response": "/api/save", "status": 200 },
    { "text": "保存成功" }
  ]
}
```

运行时每次重新 resolve。多候选时应返回候选，不应自动猜。

## 4. 认知域

`pwcli` 面向 Agent 的核心认知域是：

```text
State -> Intent -> Operation -> Transition -> Evidence
```

### 4.1 State

浏览器任务当前状态。

包括：

- session
- active page
- workspace tabs
- visible content
- interactive affordances
- identity / auth hints
- diagnostics surface
- artifacts

State 非全量 DOM。它是 Agent 决策所需的紧凑读模型。

### 4.2 Intent

Agent 当前要推进的目的。

常见 intent：

- login
- navigate
- inspect
- fill
- submit
- download
- reproduce bug
- verify fix
- recover

Intent 不应参与魔法执行。它用于解释操作、组织证据、辅助 transition 判断。

### 4.3 Operation

对 State 的一次受控变更。

Operation 可以来自：

- CLI command
- injected Playwright step
- mock mutation
- environment mutation
- state save / load

`pw code` 不应被视为旁路。它是 Operation 的高级载体。

### 4.4 Transition

Operation 导致的状态转移。

统一分类：

- `succeeded`
- `changed`
- `pending`
- `blocked`
- `failed`
- `no-op`
- `unknown`

Diff 只是 Transition 的证据，认知域中心仍是 Transition。

### 4.5 Evidence

可交接、可复现、可回归的事实。

包括：

- step record
- diagnostics delta
- diagnostics digest
- trace
- screenshot
- network / console / errors
- downloaded files
- storage state

Evidence 的组织单位应是 task transition，避免退化成零散命令日志。

## 5. 能力映射

### 5.1 Task Loop

```text
prepare -> locate -> act -> wait -> verify -> recover -> evidence
```

映射到认知域：

```text
State -> Intent -> Operation -> Transition -> Evidence
```

关键能力：

- State read model
- semantic target resolution
- intent-aware operation
- transition classification
- recover hints
- evidence package

### 5.2 Debug Loop

```text
action -> diagnosticsDelta -> digest -> export -> mock -> rerun
```

映射到认知域：

```text
State -> Intent(reproduce/fix) -> Operation -> Transition -> Evidence
```

关键能力：

- diagnostics as state surface
- action-scoped diagnostics delta
- mock as operation pattern
- rerun as transition comparison
- evidence export

### 5.3 Test Loop

```text
semantic target -> action -> expected transition -> artifact -> replayable failure
```

映射到认知域：

```text
State fixture -> Intent assertion -> Operation -> Transition expected/mismatch -> Evidence
```

关键能力：

- semantic target
- expected transition
- deterministic artifact
- replayable failure evidence

## 6. Code Lane 定位

`pw code` 的目标应避免让 Agent 一次写完整流程。

更稳定的形态是 incremental program synthesis：

```text
observe current state -> synthesize small step -> execute -> inspect transition -> decide next step
```

所以 code lane 应被定义为：

```text
high-level Playwright operation carrier
```

未来如果扩展，方向应是注入稳定 helper，让 Agent 写短小受控 step，减少裸写脆弱 Playwright 片段。

示意：

```js
async ({ page, pw }) => {
  const submit = await pw.locate({ role: "button", name: "提交" });

  await pw.step("submit form", async () => {
    await pw.click(submit);
    await pw.wait.response("/api/save", { status: 200 });
    await pw.verify.text("保存成功");
  });

  return pw.transition();
}
```

这段示意不代表当前已支持 API。

## 7. Step Diff 的位置

Step Diff 不应作为中心方案。

它属于 Transition 的证据层，目标是：

```text
what changed enough to decide next step
```

稳定信号优先：

- URL / title / pageId / pageCount
- network delta
- console / error delta
- dialog signal
- download / upload artifact
- storage / cookie mutation
- explicit verify result

中等稳定信号：

- appeared / disappeared text
- interactive target added / removed
- focused element
- enabled / disabled changed

不应优先做：

- full DOM diff
- full innerText diff
- CSS class diff
- visual diff
- timestamp / counter diff
- selector healing

Transition classifier 应由规则驱动，不依赖 LLM。

## 8. 稳定资产形态

长期资产应保存 pattern，不保存短命 ref。

推荐资产形态：

```text
locate-and-act
click-and-wait-response
fill-by-labels
download-and-verify
mock-and-rerun
recover-blocked
```

这些 pattern 的输入是：

- 当前 State
- Intent
- semantic target
- expected Transition

输出是：

- Operation result
- Transition classification
- Evidence refs

## 9. 当前结论

`pwcli` 下一阶段的核心不应继续堆更多 Playwright primitive。

更合理的架构方向是：

```text
Browser Task State Model
```

实施时可拆成：

1. State read model
2. intent-aware operation
3. transition record
4. semantic target resolution
5. evidence package
6. high-level code helper

这些是方向，非一次性实现范围。

任何后续实现都应先回答：

1. 它服务哪个目标场景？
2. 它落在 State / Intent / Operation / Transition / Evidence 哪一层？
3. 它是否提升 Agent 下一步决策能力？
4. 它是否避免保存短命 ref / selector？
5. 它是否产生可交接证据？

答不上来，就不应进入主线。
