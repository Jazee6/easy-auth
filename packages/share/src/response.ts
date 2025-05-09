export enum Code {
  ParamsWrong = 4000,
  LoginExpired = 4001,
  TurnstileFailed = 4002,
  UserExists = 4003,
  EmailOrPasswordIncorrect,
  AccountAlreadyLinked,
}

const Message = {
  [Code.ParamsWrong]: "Params is wrong",
  [Code.LoginExpired]: "Login expired",
  [Code.TurnstileFailed]: "Turnstile failed",
  [Code.UserExists]: "User exists",
  [Code.EmailOrPasswordIncorrect]: "Email or password is incorrect",
  [Code.AccountAlreadyLinked]: "Account already linked",
} as const;

export interface ErrorResponse {
  code: Code;
  message: (typeof Message)[Code];
}

export const err = (code: Code) =>
  JSON.stringify({
    code,
    message: Message[code],
  });
