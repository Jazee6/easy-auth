import { env, waitUntil } from "cloudflare:workers";

import {
  assertProductionAuthEnvironment,
  createEasyAuth,
  type AuthEnvironment,
} from "./auth-factory";

const environment = env as AuthEnvironment;
if (import.meta.env.PROD) assertProductionAuthEnvironment(environment);

export const auth = createEasyAuth({
  environment,
  waitUntil,
});
