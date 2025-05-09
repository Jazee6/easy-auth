import * as jose from "jose";

interface User {
  email: string;
  nickname: string;
  avatar: string;
  createdAt: string;
}

export class EasyAuthClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly host: string;
  private readonly JWKS;
  private userMap: Map<string, User & { lastGet: Date }> = new Map();

  constructor({
    appId,
    appSecret,
    host,
  }: {
    appId: string;
    appSecret: string;
    host: string;
  }) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.host = host;
    this.JWKS = jose.createRemoteJWKSet(
      new URL("/oidc/.well-known/jwks.json?client_id=" + this.appId, this.host),
    );
  }

  onLoginRedirect = async (code: string) => {
    const url = new URL("/oidc/token", this.host);
    url.searchParams.append("code", code);
    url.searchParams.append("client_id", this.appId);
    url.searchParams.append("appSecret", this.appSecret);
    const res = await fetch(url);
    if (res.ok) {
      const data: {
        id_token: string;
      } = await res.json();
      return data;
    }

    throw new Error(res.statusText);
  };

  verifyES256JWT = async (jwt: string) => {
    const { payload } = await jose
      .jwtVerify(jwt, this.JWKS)
      .catch(async (error) => {
        if (error?.code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS") {
          for await (const publicKey of error) {
            try {
              return await jose.jwtVerify(jwt, publicKey);
            } catch (innerError: any) {
              if (
                innerError?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"
              ) {
                continue;
              }
              throw innerError;
            }
          }
          throw new jose.errors.JWSSignatureVerificationFailed();
        }

        throw error;
      });
    return payload;
  };

  getUserInfo = async (id_token: string) => {
    if (this.userMap.has(id_token)) {
      const user = this.userMap.get(id_token)!;
      if (user.lastGet!.getTime() + 1000 * 60 > Date.now()) {
        return { ...user, lastGet: undefined };
      }
    }

    const url = new URL("/info", this.host);
    url.searchParams.append("client_id", this.appId);
    url.searchParams.append("id_token", id_token);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    const data: User = await res.json();
    this.userMap.set(id_token, { ...data, lastGet: new Date() });
    return data;
  };
}
