import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TwoFactorBadge } from "./account-badges";

describe("Two-Factor status badge", () => {
  test("presents the authoritative Enabled or Disabled state", () => {
    const enabled = renderToStaticMarkup(<TwoFactorBadge enabled />);
    const disabled = renderToStaticMarkup(<TwoFactorBadge enabled={false} />);

    expect(enabled).toContain(">Enabled</span>");
    expect(disabled).toContain(">Disabled</span>");
  });
});
