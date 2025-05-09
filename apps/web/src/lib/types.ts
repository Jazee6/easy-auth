type Provider = "github";

export interface User {
  createdAt: string;
  email: string;
  avatar?: string;
  nickname?: string;
  scope: string | null;
  accounts: {
    id: string;
    provider: Provider;
    name: string;
  }[];
}

export type LoginResponse = {
  redirect: string;
} | null;

export interface AppInfo {
  name: string;
  createdAt: string;
}
