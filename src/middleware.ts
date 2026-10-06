import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
    pages: {
      signIn: "/login"
    }
  }
);

// Schützt alle Seiten außer Startseite (regelt Weiterleitung selbst), Login,
// Setup, statische Assets, App-Icons, Manifest und API-Auth-Routen.
export const config = {
  matcher: [
    "/((?!login|setup|api/auth|api/setup|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-192.png|icon-512.png|manifest.webmanifest|$).*)"
  ]
};
