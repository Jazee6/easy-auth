import { Code, err } from "@easy-auth/share";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { app_secret, type Variables, verifyHS256JWT } from "./utils";

interface Vars {
  Variables: Variables;
}

export const auth = createMiddleware<Vars>(async (c, next) => {
  const token = getCookie(c, "id_token");
  if (!token) {
    throw new HTTPException(401);
  }
  let res = null;
  try {
    res = await verifyHS256JWT(token, app_secret);
  } catch (e: any) {
    if (e.code === "ERR_JWT_EXPIRED") {
      throw new HTTPException(401, { message: err(Code.LoginExpired) });
    }
    throw new HTTPException(401);
  }
  c.set("payload", res.payload as Variables["payload"]);
  await next();
});

export const authWithoutErr = createMiddleware<Vars>(async (c, next) => {
  const token = getCookie(c, "id_token");
  if (!token) {
    return c.body(null, 200);
  }
  let res = null;
  try {
    res = await verifyHS256JWT(token, app_secret);
  } catch (e: any) {
    return c.body(null, 200);
  }
  c.set("payload", res.payload as Variables["payload"]);
  await next();
});

export const validateScope = createMiddleware<Vars>(async (c, next) => {
  const { scope } = c.get("payload");
  if (scope !== "admin") {
    throw new HTTPException(403);
  }
  await next();
});
