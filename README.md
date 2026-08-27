# Easy Auth

Easy Auth is an open-source, self-hosted authentication foundation for an identity domain on the Cloudflare stack.

> **Status (Version 0.1.0)**: Development-stage authentication foundation. Version 0.1.0 establishes open registration, email/password authentication, local Cloudflare D1 persistence, a session-aware application shell, and user profile management. OIDC Provider endpoints, OAuth flows, and production deployments are planned for future milestones.

---

## Architecture & Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) with TanStack Router
- **Authentication**: [Better Auth](https://www.better-auth.com/) with TanStack Start cookie integration
- **Database & Persistence**: [Cloudflare D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM](https://orm.drizzle.team/)
- **UI & Components**: [shadcn/ui](https://ui.shadcn.com/) (`base-vega` style) + [Base UI](https://base-ui.com/) Toast + [Tailwind CSS v4](https://tailwindcss.com/)
- **Forms & Validation**: [TanStack Form](https://tanstack.com/form) + [Valibot](https://valibot.dev/)
- **Testing & Runtime**: [Bun](https://bun.sh/)

---

## Local Setup & Migration

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+)

### 1. Install Dependencies
```bash
bun install
```

### 2. Run Local D1 Migrations
Initialize and migrate the local Cloudflare D1 database:
```bash
bun run db:migrate:local
```
*(Or directly using Wrangler: `bun x wrangler d1 migrations apply DB --local`)*

### 3. Start Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Manual Acceptance Flow

Follow these steps to manually verify the complete 0.1.0 authentication lifecycle:

### 1. Root & Unauthenticated Redirect
- Visit `http://localhost:3000/`.
- **Expected**: Automatically redirects to `http://localhost:3000/login`.

### 2. Open Registration (Signup)
- Click **Sign up** to navigate to `/signup`.
- Notice the minimal form requesting only **Email** and **Password** (no name field or password confirmation).
- Notice the disabled **Sign up with Google (Coming soon)** button.
- Enter an email (e.g. `alice+demo@example.com`) and password (at least 8 characters).
- Click **Create user**.
- **Expected**: A session is created and you are navigated directly to `/profile`.

### 3. Inspect Initial Profile
- In the User Panel (`/profile`), confirm:
  - **Full Name** defaults to the derived local part: `alice+demo`.
  - **Login Email** displays `alice+demo@example.com` as read-only.
  - Sidebar footer shows `alice+demo`, the email, and fallback avatar initials (`A`).

### 4. Edit Profile & Toast Feedback
- Update **Full Name** to `Alice Demo`.
- Enter an optional HTTPS avatar URL (e.g. `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`).
- Click **Save Changes**.
- **Expected**:
  - A Base UI success Toast appears: *"Profile updated"*.
  - The sidebar footer and avatar preview immediately reflect the new name and image.

### 5. Sign Out
- Click the user item in the sidebar footer to open the dropdown menu.
- Confirm the menu contains only **Log out**.
- Click **Log out**.
- **Expected**: Session is terminated and you are redirected to `/login`.

### 6. Protected Route Guard
- While signed out, navigate directly to `http://localhost:3000/profile`.
- **Expected**: Access is blocked and you are redirected to `/login`.

### 7. Sign In & Data Persistence
- On `/login`, enter `alice+demo@example.com` and your password.
- Notice the disabled **Forgot password? (Coming soon)** and **Login with Google (Coming soon)** controls.
- Click **Login**.
- **Expected**: Authenticated successfully, redirected to `/profile`, showing persisted name `Alice Demo` and avatar URL.

### 8. Authenticated Route Redirect
- While logged in, navigate to `http://localhost:3000/login` or `http://localhost:3000/signup`.
- **Expected**: Automatically redirects to `/profile`.

### 9. Validation & Error Handling Checks
- **Short Password**: On signup/login, enter `< 8` characters -> Error appears beside password field.
- **Invalid Email**: Enter `not-an-email` -> Error appears beside email field.
- **Invalid Credentials**: Enter wrong password on login -> Shows generic error message (*"Invalid email or password"*).
- **Duplicate Registration**: Attempt to register `alice+demo@example.com` again -> Shows generic error message (*"Unable to create user with provided details"*).
- **Invalid Avatar URL**: In profile, enter `http://insecure.com/img.png` or `invalid-url` -> Error appears beside avatar field.

---

## Available Scripts

- `bun run dev` - Start local development server
- `bun run build` - Build production client and SSR bundles
- `bun test` - Run automated test suite (authentication flow policy)
- `bun run typecheck` - Run TypeScript type checking
- `bun run lint` - Run Oxlint
- `bun run db:generate` - Generate Drizzle SQL migrations from schema
- `bun run db:migrate:local` - Apply migrations to local D1 database
