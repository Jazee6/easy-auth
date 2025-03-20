import { createMiddleware } from "hono/factory";
import { app_secret, verifyHS256JWT } from "./utils";
import { getCookie } from "hono/cookie";
import { Code, err } from "@easy-auth/share";

export const auth = createMiddleware(async (c, next) => {
  const token = getCookie(c, "id_token");
  if (!token) {
    return c.json(err(Code.LoginRequired), 401);
  }
  let res = null;
  try {
    res = await verifyHS256JWT(token, app_secret);
  } catch (e: any) {
    if (e.code === "ERR_JWT_EXPIRED") {
      return c.json(err(Code.LoginExpired), 401);
    }
    return c.json(err(Code.LoginRequired), 401);
  }
  c.set("payload", res.payload);
  await next();
});
