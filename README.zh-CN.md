<p align="center">
  <img src="assets/git_banner.png" alt="Arcgram — human-led design, AI-accelerated execution" width="100%">
</p>

<p align="center">
  <a href="https://arcgram.io"><img src="https://img.shields.io/badge/website-arcgram.io-C69A4C" alt="Website"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-6B4E3D" alt="License: Apache 2.0"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/English-lightgrey" alt="English"></a>
  <img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-5A4632" alt="简体中文">
  <a href="README.es.md"><img src="https://img.shields.io/badge/Espa%C3%B1ol-lightgrey" alt="Español"></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Fran%C3%A7ais-lightgrey" alt="Français"></a>
</p>

# Arcgram

**Arcgram 把你 AI 的计划变成一张图——在它动手之前，你可以先检查、再修正。**

<p align="center">
  <img src="assets/usage-workflow.svg" alt="Arcgram 协作循环——AI 提议、绘制、自查，你指出哪里错，它来修" width="900">
</p>

一份由你的 AI Agent 产出的文档，或者是用通用提示词写的分析报告流程／计划／代码等，表面看起来通顺，即使你是一个专业资深的开发者，你也不会知道在长篇大论的上下文中有没有逻辑上的漏洞或者是暗藏的深坑。更要命的是 AI 喜欢一本正经的胡说八道，你压根不知道它自己的推理机制是怎么样的，以及如何触发的。

Arcgram 就是一个你能用来指挥你的 Agent 的工具，让 agent 把自己脑子里的推理逻辑变成一张你跟你的 Agent 同时都能理解并且能看得懂的推理关系图——少了一步，是一根悬空的线；出现循环依赖，是一个你一眼看得见的死循环。它在产出流程节点的同时，就已经运算过这些节点之间的关系了；而且 agent 会调用自带的 Audit 自审工具，把出问题的、可以优化的节点直接标在图上，让你能有针对性地修复、优化当前流程里的毛病。

## 支持跨平台模型

- 可在 Claude、GPT、Gemini、DeepSeek、Kimi、智谱 GLM 上运行，Cursor、Cline、Aider 这类工具里也行，乃至本地中等模型也能跑。
- 产物是一个零依赖的 HTML 文件——约 290 KB，可平移 / 缩放 / 悬停 / 筛选，任意浏览器直接打开。无需构建，无需 npm，无需 CDN，什么都不用跑。

## 直接点开样本测试

在线示例（免安装，点开即用）——试试平移 / 缩放 / 悬停：

- [游戏系统分部流程图](https://jovesun-lab.github.io/arcgram/examples/example.html) —— 标准示例：悬停提示、分列、关键路径
- [决策判定图](https://jovesun-lab.github.io/arcgram/examples/example-thinkflow.html) —— 菱形判断、Yes/No 分支、反馈回环
- [如何使用 Arcgram](https://jovesun-lab.github.io/arcgram/examples/usage-workflow.html) —— Arcgram 的基本工作流程：Agent 如何用它跟用户沟通 > 反馈 > 修改 > 确认
- [自己打脸模式](https://jovesun-lab.github.io/arcgram/examples/example-audit.html) —— 用附带的 skill 自我审查。比如你的 Agent 给了你好几个方案，你不知道该选哪个、哪个最优、哪个最好维护，就让它用这个工具把毛病自己标出来。

**安装**（Claude Code / Cowork）：

```
/plugin marketplace add jovesun-lab/arcgram
/plugin install arcgram
```

除了基础的流程图技能，还给 agent 装上三个自查（Checkpoint / Reconcile / Validate）。然后直接对它说一句——*"把当前 Handoff 的工作机制用 Arcgram 跑一下，再用 Audit 工具检查一遍"*，或者 *"把这个计划用 Arcgram 跑一下"*。

**agent 必须遵守：** 读 `SKILL.md`，复制 `template-v2.html`，填好顶部的数据块，交付这个文件。`END OF DATA SECTION` 以下别碰——那是引擎。就这一个文件，别无其他：

```
curl -O https://raw.githubusercontent.com/jovesun-lab/arcgram/main/template-v2.html
```

> 别在 CI 或 agent 流程里 `git clone` 整个仓库——上面这一个文件就够了。

## Arcgram 的功能清单

把当前功能按用途分组——当作一页功能清单来看。

<sub>关注官网 [blog](https://arcgram.io/blog/)，我们会不定期分享实用技巧及案例。</sub>

<p align="center">
  <img src="assets/feature-tree.svg" alt="Arcgram 功能树——所有功能按用途分组" width="900">
</p>

## Mermaid 与 Arcgram

Mermaid 和 Arcgram 都是"写好数据、让机器渲染成图"——区别不在这儿，而在**谁在写、为什么写**：Mermaid 是**你手写**、画给人看的图；Arcgram 是**你的 agent** 从它自己的计划里吐出数据、画出来给你**核对**的图。其余的区别，都是从这一点推出来的：

| | Mermaid | Arcgram |
|---|---|---|
| 谁来画 | 你，手写 | 你的 agent，从它自己的计划里画 |
| 布局 | 自动，每次都会变 | 位置固定——每个节点都不动，都能被指着说 |
| 计划里的缺口 | 照样渲染，藏得好好的 | 变成一根你看得见的断线 |
| 自查 | 没有 | 有——你看到图之前，agent 已经跑过三道自查 |
| 分享 | 需要一个渲染器 | 一个 HTML 文件，哪儿都能打开 |

开始之前，有两点值得先知道：

- **能指着一个节点说"这儿错了"，才是重点。** 每个节点都有固定的名字和位置。发现 agent 想岔了，你不用打一大段话去描述"就是流程中段、扣款之前那个地方"——直接一句"'库存检查'那个节点，No 分支接错了"，它立刻定位，几秒改完。
- **技能越用越顺手。** 每踩一个坑，都会变成技能文件里的一条规则。比如"两条线在节点上叠在一起、分不清谁连谁"——这条教训写进去后，下一个 agent 画图自动把线错开，你不用再提。用得越久，要你返工的地方越少。

## 创作流程到底怎么跑

**数据是 agent 写的，你只负责改。** 从来不需要你手动摆放节点。

1. 你的 agent 读技能，把一小块数据——节点、节点之间的连线、可选的分组——写进 `template-v2.html` 的副本里。
2. 它跑一遍自查，把查出来的问题修掉。
3. 你打开文件，四处看看，指出哪里不对——报个名字，用大白话说就行。
4. agent 改数据，你重新打开。搞定。

手边没有 agent？数据你也可以手动改——打开 `template-v2.html`，格式就写在 `END OF DATA SECTION` 这一行上方。这一行以下是引擎，别去碰。完整说明：[`schema.md`](schema.md) · agent 指南：[`USAGE.md`](USAGE.md) · 布局帮助：[`layout-tips.md`](layout-tips.md)

## 本次发布包含什么

| 文件 | 是什么 |
|---|---|
| `template-v2.html` | 引擎。复制它，让 agent 填好数据，最后交付这一个文件。 |
| `examples/example.html` | **从这里开始。** 一个小的游戏循环：分组筛选、分列、悬停提示、关键路径。 |
| `examples/example-thinkflow.html` | 菱形判断、Yes/No 分支、反馈回环。 |
| `examples/example-workflow.html` | 一个真实的生产工作流，自上而下布局。 |
| `examples/example-workflow-H.html` | 同一个工作流，改成从左到右。 |
| `examples/example-bands.html` | 横向"分带"布局——用分带之前先看这个。 |
| `examples/example-audit.html` | 审查模式：红色标记钉住尚未解决的问题，悬停看说明。 |
| `examples/example-harness.html` | 把自查系统本身画成的一张图。 |
| `schema.md` | 数据格式的完整参考。 |
| `USAGE.md` | 如何从 AI agent 驱动 Arcgram。 |
| `layout-tips.md` | 布局与摆放建议。 |
| `themes/` | 两个 CSS 文件，留作参考和二次开发（引擎里已经内联了）。 |

## v2 有哪些新东西

从左到右的布局（不再只有自上而下）· 用于 if/then 流程的判断节点 · 点开一个节点看嵌套子图 · 在任意节点上钉一个红旗，标出尚未解决的问题 · 左上角筛选器，一次只高亮一组 · 更整洁的连线走线 · 内置主题。

## 许可与署名

Apache License 2.0——随便用、随便改、放进商业产品、直接发布都行。见 [`LICENSE`](LICENSE) 和 [`NOTICE`](NOTICE)。

每张图都带一个小小的 "Made with Arcgram" 标记（顶栏上一个徽标，加上文件头里一行说明）。保留它是免费的，署名就是这么运作的（Apache §4(d)）。去标记版本需要另外的商业许可——见 [`WATERMARK-AND-COMMERCIAL-TERMS.md`](WATERMARK-AND-COMMERCIAL-TERMS.md)。

"Arcgram" 和它的 logo 是 Rae Sun 的商标。你可以说自己的作品是 "made with Arcgram"，但别把这个名字或 logo 安到你自己的产品上。

更早的版本用的是 MIT 许可；已经拿到的副本，那份授权继续有效。从这次发布起，适用 Apache 2.0。
