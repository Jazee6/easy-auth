# Easy Auth

中文 ｜ [English](./README.en.md)

## 部署

### 环境变量列表

| 名称                             | 描述                   |
|--------------------------------|----------------------|
| BETTER_AUTH_SECRET             | 用于加密、签名和哈希的密钥        |  
| BETTER_AUTH_URL                | origin URL           |
| DATABASE_URL                   | postgres数据库地址        |
| GITHUB_CLIENT_ID               | Github OAuth         |
| GITHUB_CLIENT_SECRET           | Github OAuth         |
| TURNSTILE_SECRET_KEY           | Cloudflare Turnstile |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Cloudflare Turnstile |

### 设置管理员

注册账号后，在数据库 `user` 表中将对应用户的 `role` 字段修改为 `admin`。
