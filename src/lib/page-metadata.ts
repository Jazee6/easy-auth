const SITE_NAME = "Easy Auth";

function title(page: string): string {
  return `${page} | ${SITE_NAME}`;
}

export function privatePageHead(page: string) {
  return {
    meta: [{ title: title(page) }],
  };
}

export function publicPageHead(page: string, canonical: string) {
  return {
    meta: [{ title: title(page) }, { name: "robots", content: "index, follow" }],
    links: [{ rel: "canonical", href: canonical }],
  };
}
