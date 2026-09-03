## Agent skills

### Issue tracker

Local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

## 项目规则

- 尽量使用shadcn/ui提供的组件和helpers，不要修改通过cli添加的组件
- 表单使用Field + Tanstack Form + Valibot
- 数据表单统一使用 `noValidate` + Valibot 提交时校验，字段变更只清除旧错误；确认密码一致性使用前缀容忍的即时校验，Turnstile/cooldown/输入约束/预览等即时行为保留
- 表格使用Data Table + Tanstack Table
- 空状态使用shadcn Empty组件
- 复制按钮使用公共组件
- 账户/管理面板页面统一使用 PageHeader
- 按钮加载状态统一在文字左侧+Spinner，状态为disabled
- 已安装reactCompiler，减少不必要代码
- 功能尽量满足Cloudflare Free Tier使用
- 实现UI前，用shadcn库的顶层组件 + 现有组件用文字排列给用户确认

## 经验教训

- `bunx shadcn add` 遇到已存在文件会交互式询问覆盖，用 `yes n | bunx shadcn add ...` 拒绝（button.tsx 等含自定义修改，不可覆盖）
- FieldLabel 内嵌 Field 即 choice-card（选中态高亮内置），RadioGroup/Checkbox 卡片直接用此模式，勿手写卡片样式
- Better Auth Native private-use Redirect URI 的 scheme-specific part 必须以单个 `/` 开头（如 `com.example:/callback`）；Create/Edit 共用 provider-compatible 校验规则
- 导航链接直接用 TanStack `Link` + `buttonVariants`；不要通过 Base UI `Button.render` 输出 `<a>`，避免按钮原生语义警告并保留链接语义
- Base UI Dialog/Sheet 退出动画期间保留内容；关闭后清理状态用 `onOpenChangeComplete(false)`，不要在 `open=false` 时立即清空
- Better Auth OAuth Provider 也使用 `/admin/*` 路径；Admin Plugin 默认拒绝必须匹配其精确端点清单，不能按 `/admin/` 前缀拦截
- Identity Domain Account 查询直接在 D1 中分页；角色过滤需按逗号分隔角色识别 `admin`，排序始终追加 User ID 作为确定性 tie-breaker
- Better Auth 全局 before hook 早于端点 middleware；放行 Admin 安全端点时用 `getAuthoritativeSessionFromCtx` 自行鉴权，after hook 先确认 `ctx.context.returned` 成功再做清理与 Security activity
- Session 管理界面只使用非凭据 Session ID；服务端按 Account + Session ID 解析私有 token，再调用 Better Auth 单 Session 撤销端点
- `bun run generate-routes` 单独执行会暂时移除 routeTree 尾部的 TanStack Start `Register` 声明；按 generate → build → diff check 顺序验证，Vite Start 插件会恢复该声明
- Security activity 日期筛选使用 UTC 日期边界：起始日 `>=` 当日零点，结束日 `<` 次日零点；反向范围交换，非法日期直接拒绝，避免静默扩大结果
- Lucide 不提供 GitHub 等品牌图标；GitHub 品牌入口复用 `src/components/github-icon.tsx`，不要假设 Lucide 存在 `GithubIcon`
