import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router";
import DashLayout from "./pages/dashboard/layout.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import Login from "@/pages/login.tsx";
import Signup from "@/pages/signup.tsx";
import Layout from "@/pages/layout.tsx";
import Profile from "@/pages/dashboard/profile.tsx";
import OAuth from "@/pages/auth/oauth.tsx";
import Link from "@/pages/dashboard/link.tsx";

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      {
        path: "login/:appId?",
        Component: Login,
      },
      {
        path: "auth/:provider/:appId",
        Component: OAuth,
      },
      {
        path: "signup/:appId?",
        Component: Signup,
      },
      {
        Component: DashLayout,
        children: [
          {
            index: true,
            Component: Profile,
          },
          {
            path: "link",
            Component: Link,
          },
          {
            path: "apps",
            Component: lazy(() => import("@/pages/dashboard/apps.tsx")),
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster richColors position="top-center" />
  </StrictMode>,
);
