export enum Code {
  Success,
  NeedConfirm,

  UnKnown = 1000,
  TurnstileRequired,
  TurnstileFailed,
  UserExists,
  EmailOrPasswordIncorrect,
  ParamsError,
  AppSecretRequired,
  LoginRequired,
  LoginExpired,
  AccountAlreadyLinked,
}

const Message = {
  [Code.Success]: "Success",
  [Code.NeedConfirm]: "Need confirm",

  [Code.UnKnown]: "Unknown error",
  [Code.TurnstileRequired]: "Turnstile token is required",
  [Code.TurnstileFailed]: "Turnstile failed",
  [Code.UserExists]: "User already exists",
  [Code.EmailOrPasswordIncorrect]: "Email or password is incorrect",
  [Code.ParamsError]: "Params error",
  [Code.AppSecretRequired]: "App secret is required",
  [Code.LoginRequired]: "Login is required",
  [Code.LoginExpired]: "Login expired",
  [Code.AccountAlreadyLinked]: "Account already linked to another user",
} as const;

const localeMessage = {
  en: Message,
};

export interface ResponseBody<T = unknown> {
  success: boolean;
  code: Code;
  message: (typeof Message)[Code];
  data: T | null;
}

export const suc = <T>(data?: T): ResponseBody<T> => ({
  success: true,
  code: Code.Success,
  message: localeMessage.en[Code.Success],
  data: data ?? null,
});

export const success = <T>(code: Code, data?: T): ResponseBody<T> => ({
  success: true,
  code,
  message: localeMessage["en"][code],
  data: data ?? null,
});

export const err = <T>(code: Code, data?: T): ResponseBody<T> => ({
  success: false,
  code,
  message: localeMessage["en"][code],
  data: data ?? null,
});
