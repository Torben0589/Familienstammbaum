"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Einrichtung fehlgeschlagen.");
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", { username, password, redirect: false });
    if (signInResult?.error) {
      setError("Konto wurde angelegt, die automatische Anmeldung ist aber fehlgeschlagen. Bitte manuell einloggen.");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">Familienstammbaum</div>
          <h1 className="text-xl font-semibold text-ink-900">Willkommen!</h1>
          <p className="text-sm text-ink-500 mt-1">
            Richte dein erstes Benutzerkonto ein, um deinen Familienstammbaum zu starten.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Dein Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Benutzername">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="Passwort (mind. 8 Zeichen)">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird eingerichtet…" : "Konto erstellen & loslegen"}
          </Button>
          <p className="text-xs text-ink-500 text-center">
            Weitere Familienmitglieder (bis zu 5) kannst du später unter „Einstellungen“ hinzufügen.
          </p>
        </form>
      </Card>
    </div>
  );
}
