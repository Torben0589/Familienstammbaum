import { type AuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Zugangsdaten",
      credentials: {
        username: { label: "Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username.trim().toLowerCase() }
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, username: user.username };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.username = (user as { username: string }).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

// Hilfsfunktion: Gibt es bereits ein Benutzerkonto? Falls nicht, befindet sich
// die App im Ersteinrichtungs-Modus (/setup).
export async function isFirstRun(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}

// Liefert die aktuelle Session oder null (für Server Components / Route Handler).
export async function getSessionOrNull() {
  return getServerSession(authOptions);
}

// Maximale Anzahl an Familienmitglieder-Konten (gemäß Anforderung, erweiterbar).
export const MAX_USERS = 5;
