## Agent skills

### Issue tracker

Local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

## 项目规则

- 简单任务交给子Agent，固定模型为3.7 flash high，fallback: 5.6 luna max
- 表单使用shadcn Field + Tanstack Form + Valibot
- 表格使用Data Table + Tanstack Table
- 按钮加载状态统一在文字左侧+Spinner，状态为disabled
- 已安装reactCompiler，减少不必要代码
- 尽量满足Free Tier使用
