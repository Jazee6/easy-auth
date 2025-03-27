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

export interface LoginResponse {
  redirect: string;
}
