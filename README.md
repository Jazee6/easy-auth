# Easy Auth

中文 ｜ [English](./README.en.md)

<img width="3588" height="1865" alt="Easy Auth 界面预览" src="https://github.com/user-attachments/assets/40277e51-b2f9-4483-9288-b6a78c1e13b8" />

Easy Auth 是面向 Cloudflare 的自托管统一身份入口与 OAuth 2.1 / OpenID Connect 授权服务器。

在线演示：<https://account.jaze.top>

## 功能

- 开放注册、登录邮箱验证、密码重置与账户资料维护
- 本地密码、GitHub、Google 和 Passkey 登录方式
- 显式关联外部身份，不根据相同邮箱隐式合并账户
- 基于 TOTP 的双重验证、备用码、可信设备与运维恢复流程
- 账户会话查看、单会话终止与全部会话终止
- OAuth 2.1 / OpenID Connect 授权码流程、PKCE、刷新令牌和授权撤销
- 公共与机密 OAuth 客户端、Web 与 Native Redirect URI 管理
- 面向管理员的账户、客户端、管理活动和安全活动界面
- Cloudflare Turnstile、D1 限流与面向 Cloudflare Free Tier 的部署方式

## 技术栈

- TanStack Start、React、TanStack Router、TanStack Query
- Better Auth、OAuth Provider、Passkey
- Cloudflare Workers、D1、Turnstile
- Drizzle ORM、Tailwind CSS、shadcn/ui
- Resend、Bun、TypeScript

## 外部身份提供方

分别登记以下回调地址：

- GitHub：`<BETTER_AUTH_URL>/api/auth/callback/github`
- Google：`<BETTER_AUTH_URL>/api/auth/callback/google`

## Runtime bindings

| Binding                   | 范围           | 用途                                                        |
| ------------------------- | -------------- | ----------------------------------------------------------- |
| `DB`                      | 服务端         | Cloudflare D1 数据库绑定                                    |
| `BETTER_AUTH_URL`         | 服务端         | Easy Auth 对外基础 URL                                      |
| `BETTER_AUTH_SECRET`      | 服务端秘密     | Better Auth 签名秘密，至少 32 个随机字符                    |
| `RESEND_API_KEY`          | 服务端秘密     | Resend API 凭据                                             |
| `EMAIL_FROM`              | 服务端         | 完整且已验证的发件身份，例如 `Easy Auth <auth@example.com>` |
| `TURNSTILE_SECRET_KEY`    | 服务端秘密     | Cloudflare Turnstile 服务端验证 Key                         |
| `VITE_TURNSTILE_SITE_KEY` | 浏览器构建变量 | Cloudflare Turnstile Managed Widget Site Key                |
| `GITHUB_CLIENT_ID`        | 服务端         | GitHub OAuth App Client ID                                  |
| `GITHUB_CLIENT_SECRET`    | 服务端秘密     | GitHub OAuth App Client Secret                              |
| `GOOGLE_CLIENT_ID`        | 服务端         | Google OAuth 2.0 Web application Client ID                  |
| `GOOGLE_CLIENT_SECRET`    | 服务端秘密     | Google OAuth 2.0 Web application Client Secret              |

## 初始化管理员

先通过正常注册和邮箱验证创建账户，再由有权访问 D1 的运维人员将该账户的 `user.role` 设置为 `admin`。例如，本地环境可以运行：

```bash
bunx wrangler d1 execute DB --local --command "UPDATE user SET role = 'admin' WHERE email = 'admin@example.com'"
```

## 安全与运维

- 在首次登记 Passkey 前确定稳定的 `BETTER_AUTH_URL`。Passkey 绑定该 URL 的 hostname 和 origin；更换域名后，旧 Passkey 将不可用。
- 部署前根据实际运营主体审查并修改隐私政策与服务条款页面。
- 双重验证恢复是仅限授权运维人员执行的流程；参见 [`docs/two-factor-recovery.md`](./docs/two-factor-recovery.md)。

## Sponsor

[Click Me](https://jaze.top/sponsor)
