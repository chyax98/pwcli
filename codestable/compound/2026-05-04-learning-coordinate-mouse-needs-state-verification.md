---
doc_type: learning
track: pitfall
date: 2026-05-04
slug: coordinate-mouse-needs-state-verification
component: interaction
severity: medium
tags:
  - mouse
  - interaction
  - agent-dogfood
  - verification
---

# 坐标级 mouse 动作必须做状态复查

## 问题

`pw mouse click` 这类坐标级命令只能证明浏览器收到了坐标动作，不能证明业务目标被命中。

## 症状

一次 Agent dogfood 中，`pw mouse click -s <session> 110 15` 返回 `acted=true`，但后续 `pw code` 读取页面状态时目标状态仍为空。动作发出了，但因为页面已 scroll/resize，坐标没有命中目标按钮。

## 没用的做法

只看 `acted=true` 就把 mouse click 判定为成功。

这会把“输入设备动作成功”误当成“业务交互成功”。

## 解法

坐标级 mouse 动作之后，必须继续用页面事实复查：

```bash
pw mouse click -s <session> <x> <y>
pw code -s <session> '<read expected page state>'
```

或使用更稳定的一等目标命令：

```bash
pw click -s <session> --selector '<selector>'
pw verify text -s <session> --text '<expected>'
```

## 为什么有效

selector/ref/semantic action 有目标 contract；坐标 action 没有。坐标会受 scroll、resize、device scale、布局变化影响。状态复查能把“动作已发出”和“页面进入预期状态”分开。

## 预防

- 默认优先使用 `click/hover/drag` 的 selector/ref/semantic target。
- 只有 canvas、低层鼠标路径或无法定位元素时才使用 `mouse *`。
- 使用 `mouse *` 后必须用 `read-text/get/is/verify/code` 复查业务状态。
- CodeStable command docs 中 `mouse` 的 proven 证据必须包含状态复查，不能只引用 `acted=true`。
