import { serve } from "@hono/node-server";
import { account } from "./routes/account.js";
import { showRoutes } from "hono/dev";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { trimTrailingSlash } from "hono/trailing-slash";
import { err, Code } from "@easy-auth/share";
import { user } from "./routes/user";

const SITE_URL = process.env.SITE_URL || "https://account.jaze.top";

const createHono = () =>
  new Hono()
    .use(logger())
    .use(compress())
    .use(cors({ origin: SITE_URL, credentials: true }))
    .use(csrf({ origin: SITE_URL }))
    .use(trimTrailingSlash());

const app = createHono().basePath("/");

app.route("/", account);
app.route("/", user);

app.all("*", (c) => c.redirect(SITE_URL));

app.onError((e, c) => {
  console.log(e);
  return c.json(err(Code.UnKnown), 500);
});

showRoutes(app);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
