import { ResponseBody } from "@easy-auth/share";

export class ResponseError<T> extends Error {
  status: number | undefined;
  data: ResponseBody<T>;

  constructor(data: ResponseBody<T>, status?: number) {
    super(data.message);
    this.status = status;
    this.data = data;
  }
}

const handleErrors = async <T>(res: Response) => {
  const data = (await res.json()) as ResponseBody<T>;

  if (!res.ok) {
    throw new ResponseError(data, res.status);
  }

  if (!data.success) {
    throw new ResponseError(data);
  }

  return data;
};

const API_URL = import.meta.env.VITE_API_URL;

export const get = async <T = unknown>(
  path: string,
  data?: { arg?: URLSearchParams },
  init?: RequestInit,
) => {
  const url = new URL(API_URL + path);
  if (data?.arg) {
    url.search = data.arg.toString();
  }
  const res = await fetch(url, { credentials: "include", ...init });
  return handleErrors<T>(res);
};

export const getData = async <T = unknown>(
  path: string,
  data?: { arg?: URLSearchParams },
  init?: RequestInit,
) => {
  const url = new URL(API_URL + path);
  if (data?.arg) {
    url.search = data.arg.toString();
  }
  const res = await fetch(url, { credentials: "include", ...init });
  const d = await handleErrors<T>(res);
  return d.data;
};

export const post = async <T = unknown>(
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

export const put = async <T = unknown>(
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

export const deleteReq = async <T = unknown>(
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
