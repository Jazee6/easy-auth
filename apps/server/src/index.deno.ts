import { app } from "./index.js";

Deno.serve({ port: Number(process.env.PORT) || 3000 }, app.fetch);
