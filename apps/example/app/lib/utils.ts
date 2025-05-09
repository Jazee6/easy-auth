import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { EasyAuthClient } from "@easy-auth/sdk";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const easyAuthClient = new EasyAuthClient({
  appId: "c576ebdc1ccc4560b29639d34e1dafbf",
  appSecret: "7e4a69ee6f9a4fa6b8f3f4ddd8fe5389",
  host: "http://localhost:3000",
});
