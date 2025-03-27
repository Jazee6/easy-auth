import * as jose from "jose";

export class EasyAuthClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly host: string;
  private readonly JWKS;

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
      new URL("/oidc/.well-known/jwks.json?appId=" + this.appId, this.host),
    );
  }

  onLoginRedirect = async (code: string) => {
    if (code.length !== 21) {
      throw new Error("Invalid code");
    }

    const url = new URL("/oidc/token", this.host);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        appId: this.appId,
        appSecret: this.appSecret,
      }),
    });
    const { success, data, message } = await res.json();
    if (success) {
      return data as { id_token: string };
    }
    throw new Error(message);
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
}
