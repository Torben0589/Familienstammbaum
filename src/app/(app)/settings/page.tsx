"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

interface UserAccount {
  id: string;
  name: string;
  username: string;
}

const MAX_USERS = 5;

export default function SettingsPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userError, setUserError] = useState<string | null>(null);
  const [gedcomMessage, setGedcomMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setUserError(data.error ?? "Fehler beim Anlegen.");
      return;
    }
    setName("");
    setUsername("");
    setPassword("");
    loadUsers();
  }

  async function removeUser(id: string) {
    if (!confirm("Dieses Benutzerkonto wirklich löschen?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    loadUsers();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setGedcomMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/gedcom/import", { method: "POST", body: formData });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setGedcomMessage(`Fehler: ${data.error ?? "Import fehlgeschlagen."}`);
      return;
    }
    setGedcomMessage(
      `Import erfolgreich: ${data.people} Personen, ${data.couples} Partnerschaften, ${data.links} Eltern-Kind-Verknüpfungen importiert.`
    );
  }

  return (
    <div className="pt-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Einstellungen</h1>
        <p className="text-ink-500 mt-1">Verwalte Zugänge und tausche Daten mit anderen Programmen aus.</p>
      </div>

      <Card>
        <h2 className="font-semibold text-ink-900 mb-1">Familienmitglieder mit Zugang</h2>
        <p className="text-sm text-ink-500 mb-4">
          Bis zu {MAX_USERS} Konten, alle mit denselben Rechten ({users.length}/{MAX_USERS} vergeben).
        </p>
        <ul className="space-y-2 mb-5">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-2.5">
              <div>
                <span className="font-medium text-ink-900">{u.name}</span>{" "}
                <span className="text-sm text-ink-500">@{u.username}</span>
              </div>
              {users.length > 1 && (
                <button className="text-ink-500 hover:text-rose-600" onClick={() => removeUser(u.id)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {users.length < MAX_USERS && (
          <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Benutzername">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </Field>
            <Field label="Passwort">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </Field>
            {userError && <p className="text-sm text-rose-600 sm:col-span-3">{userError}</p>}
            <Button type="submit" className="sm:col-span-3">
              Konto hinzufügen
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-ink-900 mb-1">GEDCOM-Austausch</h2>
        <p className="text-sm text-ink-500 mb-4">
          GEDCOM ist das Standardformat für Stammbaumdaten – kompatibel mit den meisten Genealogie-Programmen.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/gedcom/export" className="glow-button-secondary">
            ⬇️ Als GEDCOM exportieren
          </a>
          <label className="glow-button-secondary cursor-pointer">
            ⬆️ GEDCOM importieren
            <input type="file" accept=".ged" className="hidden" onChange={handleImport} />
          </label>
        </div>
        {importing && <p className="text-sm text-ink-500 mt-3">Importiere…</p>}
        {gedcomMessage && <p className="text-sm text-ink-700 mt-3">{gedcomMessage}</p>}
      </Card>

      <Card>
        <h2 className="font-semibold text-ink-900 mb-1">Angemeldet als</h2>
        <p className="text-sm text-ink-700">{session?.user?.name} (@{(session?.user as any)?.username})</p>
      </Card>
    </div>
  );
}
