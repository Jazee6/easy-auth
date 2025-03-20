import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import DashLayout from "./pages/dashboard/layout.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import Login from "@/pages/login.tsx";
import Signup from "@/pages/signup.tsx";
import Layout from "@/pages/layout.tsx";
import Profile from "@/pages/dashboard/profile.tsx";
import OAuth from "@/pages/auth/oauth.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="login" element={<Login />} />
          <Route path="auth/:provider" element={<OAuth />} />
          <Route path="signup" element={<Signup />} />

          <Route path="/" element={<DashLayout />}>
            <Route index element={<Profile />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    <Toaster richColors position="top-center" />
  </StrictMode>,
);
