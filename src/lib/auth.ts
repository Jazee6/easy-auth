import { env, waitUntil } from "cloudflare:workers";

import { createEasyAuth, type AuthEnvironment } from "./auth-factory";

export const auth = createEasyAuth({
  environment: env as AuthEnvironment,
  waitUntil,
});
