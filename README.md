# Easy Auth

中文 ｜ [English](./README.en.md)

![banner](https://github.com/user-attachments/assets/857cc611-7ad4-4364-b4a4-32c70ce3ccca)

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

### 数据库

默认使用 Postgres 作为数据库。请确保 `DATABASE_URL` 环境变量正确指向数据库地址。

`bun run push` 进行数据库迁移。

### 设置管理员

注册账号后，在数据库 `user` 表中将对应用户的 `role` 字段修改为 `admin`。

### 更多指南

请参考：[Easy Auth 使用指南](https://jaze.top/posts/easy-auth)
