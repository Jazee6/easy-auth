## Agent skills

### Issue tracker

Local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

## 项目规则

- 简单且繁琐的任务交给子Agent，固定模型为5.6 luna max
- 表单使用shadcn Field + Tanstack Form + Valibot
- 表格使用Data Table + Tanstack Table
- 空状态使用shadcn Empty组件
- 账户/管理面板页面统一使用 PageHeader
- 按钮加载状态统一在文字左侧+Spinner，状态为disabled
- 已安装reactCompiler，减少不必要代码
- 功能尽量满足Cloudflare Free Tier使用
- 实现UI前，用shadcn库的顶层组件 + 现有组件用文字排列给用户确认

## 经验教训

- `bunx shadcn add` 遇到已存在文件会交互式询问覆盖，用 `yes n | bunx shadcn add ...` 拒绝（button.tsx 等含自定义修改，不可覆盖）
- FieldLabel 内嵌 Field 即 choice-card（选中态高亮内置），RadioGroup/Checkbox 卡片直接用此模式，勿手写卡片样式
