import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { startJobs } from "./lib/jobs.js";
import { account } from "./routes/account.js";
import { apps } from "./routes/apps.js";
import { user } from "./routes/user.js";

const SITE_URL = process.env.SITE_URL || "https://account.jaze.top";

const createHono = () =>
  new Hono()
    .use(logger())
    .use(compress())
    .use(cors({ origin: SITE_URL, credentials: true }))
    .use(csrf({ origin: SITE_URL }));

const app = createHono().basePath("/");

app.route("/", account);
app.route("/", user);
app.route("/", apps);

app.all("*", (c) => c.redirect(SITE_URL));

app.onError((err) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error(err);
  return new Response("", {
    status: 500,
  });
});

showRoutes(app);

startJobs();

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
