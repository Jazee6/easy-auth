export class EasyAuthWeb {
  private readonly appId;
  private readonly host;

  public readonly loginUrl;

  constructor({
    appId,
    host,
  }: {
    appId: string;
    host: string;
    loginHost?: string;
  }) {
    this.appId = appId;
    this.host = host;
    this.loginUrl = new URL(`/login/${this.appId}`, this.host);
  }

  openLoginWindow = () => {
    const state = Math.random().toString(36).slice(2);
    this.loginUrl.searchParams.set("state", state);
    sessionStorage.setItem("state", state);
    location.href = this.loginUrl.href;
  };
}
