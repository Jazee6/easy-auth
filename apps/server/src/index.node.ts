import { serve } from "@hono/node-server";
import { app } from "./index.js";

// app.use(
//   "/*",
//   serveStatic({
//     root: "./public",
//     index: "index.html",
//     rewriteRequestPath: (path) => {
//       if (path.startsWith("/api")) {
//         return path;
//       }
//       if (/\.(css|js|ico)$/i.test(path)) {
//         return path;
//       }
//       return "/";
//     },
//   }),
// );

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
  },
  (info) => {
    console.log(`Server is running on :${info.port}`);
  },
);
