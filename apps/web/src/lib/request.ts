import { Code, ErrorResponse } from "@easy-auth/share";

export class ResponseError extends Error {
  status: number;
  code?: Code;

  constructor(status: number, message: string, code?: Code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const handleErrors = async <T>(res: Response) => {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const message = (data as ErrorResponse)?.message || res.statusText;
    const code = (data as ErrorResponse)?.code;
    throw new ResponseError(res.status, message, code);
  }

  return data as T;
};

const API_URL = import.meta.env.VITE_API_URL;

export const get = async <T>(
  path: string,
  data?: { arg?: URLSearchParams },
  init?: RequestInit,
) => {
  let url = API_URL + path;
  if (data?.arg) {
    url += data.arg.toString();
  }
  const res = await fetch(url, { credentials: "include", ...init });
  return handleErrors<T>(res);
};

export const post = async <T>(
  path: string,
  data: {
    arg: unknown;
  },
  init?: RequestInit,
) => {
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data.arg),
    credentials: "include",
    ...init,
  });

  return handleErrors<T>(res);
};

export const put = async <T>(
  path: string,
  data: {
    arg: unknown;
  },
  init?: RequestInit,
) => {
  const res = await fetch(API_URL + path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data.arg),
    credentials: "include",
    ...init,
  });

  return handleErrors<T>(res);
};

export const patch = async <T>(
  path: string,
  data: {
    arg: unknown;
  },
  init?: RequestInit,
) => {
  const res = await fetch(API_URL + path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data.arg),
    credentials: "include",
    ...init,
  });

  return handleErrors<T>(res);
};

export const deleteReq = async <T>(
  path: string,
  data: {
    arg: unknown;
  },
  init?: RequestInit,
) => {
  const res = await fetch(API_URL + path, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data.arg),
    credentials: "include",
    ...init,
  });

  return handleErrors<T>(res);
};
