import { serve } from "@hono/node-server";
import { app } from "./index.js";

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
  },
  (info) => {
    console.log(`Server is running on :${info.port}`);
  },
);
