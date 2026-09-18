# 架构图与数据流转图

本目录存放 `chrome-agent-browser` 的程序架构图与数据流转图。

| 文件 | 说明 |
|---|---|
| `agent-browser-architecture.html` | 程序架构图（可交互 HTML，内联 SVG） |
| `agent-browser-architecture.png` | 程序架构图（README 用，2x 高清） |
| `agent-browser-data-flow.html` | 数据流转与分层执行拓扑图（可交互 HTML） |
| `agent-browser-data-flow.png` | 数据流转图（README 用，2x 高清） |

## 设计规范

两图均按 `diagram-design` skill 的类型契约制作：

- **架构图** → `Architecture` 类型：Zone 分组（信任/部署边界）、正交圆角走线（`r=8` 的 `Q` 贝塞尔，禁用斜线）、
  上/下端口进出、1–2 个 Focal 高亮节点、Zone eyebrow 标签带 paper 色遮罩、绘制 z-order 为 bg → zones → arrows → labels → nodes。
- **数据流转图** → `Data Flow` 类型：4 阶段泳道拓扑、虚线表达被动/并行旁路（审计落盘）、
  分叉再汇合处遵守 bridge/hop 规则、Focal 阶段与 Focal 节点各一处。

自检（skill 内置脚本，校验无障碍 SVG 契约与单文件安全规则）：

```bash
python3 ~/.agents/skills/diagram-design/scripts/self_check.py docs/diagrams/*.html
```

## 重新渲染 PNG

修改 HTML 后重新导出 README 用图：

```bash
npm run diagrams
# 等价于
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 scripts/render_diagrams.py
```

脚本使用 Playwright（Chromium）以 `deviceScaleFactor=2` 截取 `.page` 元素，输出同名 `.png`。
