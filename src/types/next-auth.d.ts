import { DefaultSession, DefaultUser } from "next-auth";

// Erweitert die Standard-Typen von NextAuth um unser zusätzliches Feld
// "username", damit TypeScript es in den callbacks (jwt/session) kennt
// und keine unsicheren Casts mehr nötig sind.

declare module "next-auth" {
  interface User extends DefaultUser {
    username: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
  }
}
