import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { EasyAuthClient } from "@easy-auth/sdk";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const easyAuthClient = new EasyAuthClient({
  appId: "YepnfmohEW2hrYP3x5LH5",
  appSecret: "ZdVfZ3KbhC618GLhA8Q3X19ZgCb7ZsVj",
  host: "http://localhost:3000",
});
