import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "ea",
  });

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|login|signup|consent|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    },
  ],
};
