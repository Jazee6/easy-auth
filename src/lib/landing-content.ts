/**
 * Copy for the product landing page. Every self-hosted instance serves the same
 * page, so its canonical URLs point at the official site to keep search engines
 * from treating each deployment as a duplicate.
 */
export const OFFICIAL_SITE_URL = "https://account.jaze.top";
export const REPOSITORY_URL = "https://github.com/Jazee6/easy-auth";
export const LICENSE_URL = "https://www.apache.org/licenses/LICENSE-2.0";

export const landingLocales = ["en", "zh"] as const;
export type LandingLocale = (typeof landingLocales)[number];

export const landingPaths: Record<LandingLocale, "/" | "/zh"> = { en: "/", zh: "/zh" };
export const landingHtmlLang: Record<LandingLocale, string> = { en: "en", zh: "zh-CN" };
export const landingOgLocale: Record<LandingLocale, string> = { en: "en_US", zh: "zh_CN" };

export function getLandingLocale(pathname: string): LandingLocale | null {
  if (pathname === "/" || pathname === "") return "en";
  if (pathname === "/zh" || pathname === "/zh/") return "zh";
  return null;
}

export type FeatureIcon = "key" | "shield" | "link" | "server" | "monitor" | "users";

export interface LandingContent {
  meta: { title: string; description: string; imageAlt: string };
  nav: {
    features: string;
    howItWorks: string;
    faq: string;
    signIn: string;
    account: string;
    language: string;
    languageLabel: string;
    github: string;
    primaryLabel: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    description: string;
    primary: string;
    primarySignedIn: string;
    secondary: string;
  };
  consent: {
    app: string;
    request: string;
    scopes: string[];
    deny: string;
    allow: string;
  };
  standards: { label: string; items: string[] };
  features: {
    title: string;
    description: string;
    items: { icon: FeatureIcon; title: string; description: string; tags?: string[] }[];
  };
  steps: {
    title: string;
    description: string;
    items: { title: string; description: string; code: string }[];
  };
  statsLabel: string;
  stats: { value: string; label: string }[];
  faq: { title: string; items: { question: string; answer: string }[] };
  cta: { title: string; description: string; primary: string; secondary: string };
  footer: { label: string; tagline: string; privacy: string; terms: string; source: string };
}

const en: LandingContent = {
  meta: {
    title: "Easy Auth — Self-hosted OAuth 2.1 & OpenID Connect server for Cloudflare",
    description:
      "Easy Auth is an open-source, self-hosted identity provider and OAuth 2.1 / OpenID Connect Authorization Server that runs on Cloudflare Workers and D1, with passwords, GitHub, Google, Passkeys and TOTP two-factor authentication.",
    imageAlt: "Easy Auth — self-hosted OAuth 2.1 and OpenID Connect on Cloudflare",
  },
  nav: {
    features: "Features",
    howItWorks: "How it works",
    faq: "FAQ",
    signIn: "Sign in",
    account: "Go to account",
    language: "中文",
    languageLabel: "切换到中文",
    github: "Easy Auth on GitHub",
    primaryLabel: "Primary",
  },
  hero: {
    eyebrow: "Open source · Apache-2.0",
    title: "One identity for ",
    titleAccent: "every app you trust.",
    description:
      "Easy Auth is a self-hosted OAuth 2.1 and OpenID Connect Authorization Server built for Cloudflare Workers and D1. Give every account a single sign-in with passwords, GitHub, Google, Passkeys and two-factor authentication — designed to run on the Cloudflare Free Tier.",
    primary: "Create an account",
    primarySignedIn: "Go to your account",
    secondary: "Deploy your own",
  },
  consent: {
    app: "Acme Notes",
    request: "wants to access your Easy Auth account",
    scopes: ["Verify your identity", "View your name and avatar", "View your email address"],
    deny: "Deny",
    allow: "Allow",
  },
  standards: {
    label: "Built on open standards",
    items: ["OAuth 2.1", "OpenID Connect", "PKCE", "WebAuthn Passkeys", "TOTP · RFC 6238"],
  },
  features: {
    title: "Everything an identity domain needs",
    description:
      "Sign-in, account security, application authorization and administration in one Cloudflare Worker.",
    items: [
      {
        icon: "key",
        title: "Four sign-in methods",
        description:
          "Accounts sign in with a password, GitHub, Google or a Passkey bound to your domain, and always keep at least one working method.",
        tags: ["Password", "GitHub", "Google", "Passkey"],
      },
      {
        icon: "server",
        title: "OAuth 2.1 & OpenID Connect",
        description:
          "Authorization Code flow with PKCE, refresh tokens, ID tokens, discovery metadata and RP-initiated logout for your trusted applications.",
        tags: ["PKCE", "OIDC Discovery", "Refresh tokens"],
      },
      {
        icon: "shield",
        title: "Two-factor authentication",
        description:
          "TOTP authenticator apps, one-time backup codes, trusted devices and a documented operator recovery procedure.",
      },
      {
        icon: "link",
        title: "Explicit identity linking",
        description:
          "GitHub and Google identities are linked deliberately from Sign-in methods — never merged implicitly because an email matches.",
      },
      {
        icon: "monitor",
        title: "Sessions & app authorizations",
        description:
          "Accounts see every active session and every application they authorized, and can revoke any of them in one click.",
      },
      {
        icon: "users",
        title: "Administrator console",
        description:
          "Manage accounts, bans, public and confidential OAuth clients, with immutable management and security activity logs.",
      },
    ],
  },
  steps: {
    title: "From clone to sign-in in three steps",
    description: "No containers, no servers to patch — one Worker and one D1 database.",
    items: [
      {
        title: "Deploy to Cloudflare",
        description:
          "Create a D1 database, set your secrets and deploy the Worker. Cron cleanup and rate limiting are included.",
        code: "bun run db:migrate\nbun run deploy",
      },
      {
        title: "Register a trusted application",
        description:
          "An administrator registers a Web or Native OAuth client and its redirect URIs from the console.",
        code: "client_id: acme-notes\ntype: web · public\nredirect_uri: https://acme.dev/cb",
      },
      {
        title: "Sign in once, everywhere",
        description:
          "Point any OpenID Connect library at the discovery document. Accounts approve each application once.",
        code: "GET /.well-known/openid-configuration",
      },
    ],
  },
  statsLabel: "Key facts",
  stats: [
    { value: "4", label: "sign-in methods" },
    { value: "1", label: "Worker + D1 database" },
    { value: "$0", label: "designed for Cloudflare Free Tier" },
    { value: "100%", label: "open source, Apache-2.0" },
  ],
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        question: "What is Easy Auth?",
        answer:
          "Easy Auth is an open-source, self-hosted identity provider that acts as an OAuth 2.1 and OpenID Connect Authorization Server. It gives every account in your identity domain one sign-in for all of your trusted applications.",
      },
      {
        question: "Does Easy Auth run on the Cloudflare Free Tier?",
        answer:
          "Yes. Easy Auth runs as a single Cloudflare Worker backed by D1, uses Turnstile for bot protection and D1-backed rate limiting, and is designed to stay within the Cloudflare Free Tier.",
      },
      {
        question: "Which sign-in methods are supported?",
        answer:
          "Easy Auth supports email and password, GitHub, Google and WebAuthn Passkeys, plus TOTP two-factor authentication with backup codes and trusted devices.",
      },
      {
        question: "How do my applications integrate with Easy Auth?",
        answer:
          "Any OAuth 2.1 or OpenID Connect client library works. Register the application as an OAuth client, then use the Authorization Code flow with PKCE against the endpoints published at /.well-known/openid-configuration.",
      },
      {
        question: "How is Easy Auth different from Auth0, Clerk or Keycloak?",
        answer:
          "Easy Auth is self-hosted and open source like Keycloak, but runs serverlessly on Cloudflare Workers instead of a JVM server, and you keep full ownership of account data in your own D1 database instead of a hosted vendor.",
      },
      {
        question: "Is Easy Auth free?",
        answer:
          "Yes. Easy Auth is free and open-source software released under the Apache License 2.0. You only pay for the Cloudflare resources you use beyond the free tier.",
      },
    ],
  },
  cta: {
    title: "Own your sign-in.",
    description: "Deploy Easy Auth on your own domain in minutes, or try this instance right now.",
    primary: "Create an account",
    secondary: "View on GitHub",
  },
  footer: {
    label: "Footer",
    tagline: "Self-hosted OAuth 2.1 & OpenID Connect for Cloudflare.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    source: "Source code",
  },
};

const zh: LandingContent = {
  meta: {
    title: "Easy Auth — 面向 Cloudflare 的自托管 OAuth 2.1 与 OpenID Connect 授权服务器",
    description:
      "Easy Auth 是开源、自托管的统一身份入口与 OAuth 2.1 / OpenID Connect 授权服务器，运行在 Cloudflare Workers 与 D1 上，支持密码、GitHub、Google、Passkey 登录与 TOTP 双重验证。",
    imageAlt: "Easy Auth — 面向 Cloudflare 的自托管 OAuth 2.1 与 OpenID Connect",
  },
  nav: {
    features: "功能",
    howItWorks: "部署流程",
    faq: "常见问题",
    signIn: "登录",
    account: "进入账户",
    language: "English",
    languageLabel: "Switch to English",
    github: "在 GitHub 上查看 Easy Auth",
    primaryLabel: "主导航",
  },
  hero: {
    eyebrow: "开源 · Apache-2.0",
    title: "一个身份，",
    titleAccent: "通行所有受信任应用。",
    description:
      "Easy Auth 是为 Cloudflare Workers 与 D1 打造的自托管 OAuth 2.1 与 OpenID Connect 授权服务器。为每个账户提供统一登录，支持密码、GitHub、Google、Passkey 与双重验证，专为 Cloudflare 免费套餐设计。",
    primary: "创建账户",
    primarySignedIn: "进入你的账户",
    secondary: "自行部署",
  },
  consent: {
    app: "Acme Notes",
    request: "请求访问你的 Easy Auth 账户",
    scopes: ["验证你的身份", "查看你的名称和头像", "查看你的邮箱地址"],
    deny: "拒绝",
    allow: "允许",
  },
  standards: {
    label: "基于开放标准构建",
    items: ["OAuth 2.1", "OpenID Connect", "PKCE", "WebAuthn Passkey", "TOTP · RFC 6238"],
  },
  features: {
    title: "身份域所需的一切",
    description: "登录、账户安全、应用授权与管理，全部运行在一个 Cloudflare Worker 中。",
    items: [
      {
        icon: "key",
        title: "四种登录方式",
        description:
          "账户可使用密码、GitHub、Google 或绑定到你域名的 Passkey 登录，并始终保留至少一种可用登录方式。",
        tags: ["密码", "GitHub", "Google", "Passkey"],
      },
      {
        icon: "server",
        title: "OAuth 2.1 与 OpenID Connect",
        description:
          "为受信任应用提供带 PKCE 的授权码流程、刷新令牌、ID Token、Discovery 元数据与 RP 发起的登出。",
        tags: ["PKCE", "OIDC Discovery", "刷新令牌"],
      },
      {
        icon: "shield",
        title: "双重验证",
        description: "支持 TOTP 验证器应用、一次性备用码、可信设备，以及有文档可循的运维恢复流程。",
      },
      {
        icon: "link",
        title: "显式关联外部身份",
        description:
          "GitHub 与 Google 身份需在登录方式中主动关联，绝不会因为邮箱相同而隐式合并账户。",
      },
      {
        icon: "monitor",
        title: "会话与应用授权",
        description: "账户可查看所有活跃会话与已授权的应用，并一键终止或撤销。",
      },
      {
        icon: "users",
        title: "管理员控制台",
        description:
          "管理账户与封禁、公共与机密 OAuth 客户端，并保留不可变的管理活动与安全活动记录。",
      },
    ],
  },
  steps: {
    title: "三步完成从部署到登录",
    description: "无需容器，无需维护服务器 —— 一个 Worker 加一个 D1 数据库。",
    items: [
      {
        title: "部署到 Cloudflare",
        description: "创建 D1 数据库、配置密钥并部署 Worker。定时清理与限流均已内置。",
        code: "bun run db:migrate\nbun run deploy",
      },
      {
        title: "登记受信任应用",
        description: "管理员在控制台中登记 Web 或 Native OAuth 客户端及其 Redirect URI。",
        code: "client_id: acme-notes\ntype: web · public\nredirect_uri: https://acme.dev/cb",
      },
      {
        title: "一次登录，处处通行",
        description:
          "任意 OpenID Connect 库指向 Discovery 文档即可接入，账户对每个应用只需授权一次。",
        code: "GET /.well-known/openid-configuration",
      },
    ],
  },
  statsLabel: "关键数据",
  stats: [
    { value: "4", label: "种登录方式" },
    { value: "1", label: "个 Worker + D1 数据库" },
    { value: "$0", label: "专为 Cloudflare 免费套餐设计" },
    { value: "100%", label: "开源，Apache-2.0" },
  ],
  faq: {
    title: "常见问题",
    items: [
      {
        question: "Easy Auth 是什么？",
        answer:
          "Easy Auth 是开源、自托管的统一身份入口，同时作为 OAuth 2.1 与 OpenID Connect 授权服务器，让身份域中的每个账户用一次登录访问所有受信任应用。",
      },
      {
        question: "Easy Auth 能在 Cloudflare 免费套餐上运行吗？",
        answer:
          "可以。Easy Auth 以单个 Cloudflare Worker 运行，数据存储在 D1，使用 Turnstile 防御机器人并基于 D1 限流，专为 Cloudflare 免费套餐的额度设计。",
      },
      {
        question: "支持哪些登录方式？",
        answer:
          "Easy Auth 支持邮箱密码、GitHub、Google 与 WebAuthn Passkey 登录，并提供基于 TOTP 的双重验证、备用码与可信设备。",
      },
      {
        question: "我的应用如何接入 Easy Auth？",
        answer:
          "任何 OAuth 2.1 或 OpenID Connect 客户端库都可以接入。先将应用登记为 OAuth 客户端，再基于 /.well-known/openid-configuration 公布的端点使用带 PKCE 的授权码流程。",
      },
      {
        question: "Easy Auth 与 Auth0、Clerk 或 Keycloak 有何不同？",
        answer:
          "Easy Auth 与 Keycloak 一样开源且可自托管，但以 Serverless 方式运行在 Cloudflare Workers 上而非 JVM 服务器；账户数据完全保存在你自己的 D1 数据库中，而不是托管服务商。",
      },
      {
        question: "Easy Auth 免费吗？",
        answer:
          "免费。Easy Auth 是基于 Apache License 2.0 发布的开源软件，你只需为超出免费额度的 Cloudflare 资源付费。",
      },
    ],
  },
  cta: {
    title: "掌控你自己的登录。",
    description: "几分钟内在你自己的域名上部署 Easy Auth，或者现在就体验这个实例。",
    primary: "创建账户",
    secondary: "在 GitHub 上查看",
  },
  footer: {
    label: "页脚",
    tagline: "面向 Cloudflare 的自托管 OAuth 2.1 与 OpenID Connect。",
    privacy: "隐私政策",
    terms: "服务条款",
    source: "源代码",
  },
};

export const landingContent: Record<LandingLocale, LandingContent> = { en, zh };

function officialUrl(path: string): string {
  return new URL(path, OFFICIAL_SITE_URL).href;
}

/** Serializes JSON-LD so it cannot close the surrounding <script> element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildLandingJsonLd(locale: LandingLocale) {
  const content = landingContent[locale];
  const url = officialUrl(landingPaths[locale]);
  const inLanguage = landingHtmlLang[locale];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${officialUrl("/")}#website`,
        name: "Easy Auth",
        url: officialUrl("/"),
        inLanguage: landingLocales.map((l) => landingHtmlLang[l]),
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${officialUrl("/")}#software`,
        name: "Easy Auth",
        url,
        description: content.meta.description,
        applicationCategory: "SecurityApplication",
        applicationSubCategory: "Identity and access management",
        operatingSystem: "Cloudflare Workers",
        image: officialUrl("/og-image.png"),
        license: LICENSE_URL,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: content.features.items.map((item) => item.title),
        sameAs: [REPOSITORY_URL],
        inLanguage,
      },
      {
        "@type": "SoftwareSourceCode",
        name: "Easy Auth",
        codeRepository: REPOSITORY_URL,
        programmingLanguage: "TypeScript",
        runtimePlatform: "Cloudflare Workers",
        license: LICENSE_URL,
        targetProduct: { "@id": `${officialUrl("/")}#software` },
      },
      {
        "@type": "FAQPage",
        url,
        inLanguage,
        mainEntity: content.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

export function landingPageHead(locale: LandingLocale) {
  const content = landingContent[locale];
  const url = officialUrl(landingPaths[locale]);
  const image = officialUrl("/og-image.png");
  const alternateLocale = locale === "en" ? "zh" : "en";

  return {
    meta: [
      { title: content.meta.title },
      { name: "description", content: content.meta.description },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: content.meta.title },
      { property: "og:description", content: content.meta.description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:alt", content: content.meta.imageAlt },
      { property: "og:locale", content: landingOgLocale[locale] },
      { property: "og:locale:alternate", content: landingOgLocale[alternateLocale] },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: content.meta.title },
      { name: "twitter:description", content: content.meta.description },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: url },
      ...landingLocales.map((l) => ({
        rel: "alternate",
        hrefLang: landingHtmlLang[l],
        href: officialUrl(landingPaths[l]),
      })),
      { rel: "alternate", hrefLang: "x-default", href: officialUrl("/") },
    ],
    scripts: [
      { type: "application/ld+json", children: serializeJsonLd(buildLandingJsonLd(locale)) },
    ],
  };
}
