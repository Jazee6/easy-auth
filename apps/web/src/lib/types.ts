type Provider = "github";

export interface User {
  createdAt: string;
  email: string;
  avatar?: string;
  nickname?: string;
  accounts: {
    id: string;
    provider: Provider;
    name: string;
  }[];
}
