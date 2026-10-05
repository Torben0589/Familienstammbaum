"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { username, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError("Benutzername oder Passwort ist falsch.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">Familienstammbaum</div>
          <h1 className="text-xl font-semibold text-ink-900">Familienstammbaum</h1>
          <p className="text-sm text-ink-500 mt-1">Melde dich an, um fortzufahren</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Benutzername">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Passwort">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Anmelden…" : "Anmelden"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
