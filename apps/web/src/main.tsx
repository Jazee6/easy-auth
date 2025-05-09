import { Toaster } from "@/components/ui/sonner.tsx";
import OAuth from "@/pages/auth/oauth.tsx";
import Link from "@/pages/dashboard/link.tsx";
import Profile from "@/pages/dashboard/profile.tsx";
import Layout from "@/pages/layout.tsx";
import Login from "@/pages/login.tsx";
import Signup from "@/pages/signup.tsx";
import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import DashLayout from "./pages/dashboard/layout.tsx";

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      {
        path: "login",
        Component: Login,
      },
      {
        path: "auth/:provider",
        Component: OAuth,
      },
      {
        path: "signup",
        Component: Signup,
      },
      {
        Component: DashLayout,
        children: [
          {
            path: "/",
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
