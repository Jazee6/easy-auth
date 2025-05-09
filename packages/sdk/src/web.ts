export class EasyAuthWeb {
  private readonly host;
  private readonly redirect_uri;

  public readonly loginUrl;

  constructor({
    appId,
    host,
    redirect_uri,
  }: {
    appId: string;
    host: string;
    redirect_uri: string;
  }) {
    this.host = host;
    this.redirect_uri = redirect_uri;
    this.loginUrl = new URL("/login", this.host);
    this.loginUrl.searchParams.set("client_id", appId);
  }

  openLoginWindow = (path?: string) => {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem("state", state);

    this.loginUrl.searchParams.set("state", state);
    const url = new URL(this.redirect_uri + (path ?? ""));
    this.loginUrl.searchParams.set("redirect_uri", url.href);
    location.href = this.loginUrl.href;
  };
}
