# 🌼 Familienstammbaum

Eine moderne, selbst gehostete Web-App zum Erfassen und Durchsuchen eures
Familienstammbaums – läuft lokal auf deinem Raspberry Pi und ist von allen
Geräten im Netzwerk (und optional per VPN) erreichbar.

## Funktionen

- **Personen verwalten**: Name, Geburtsname, Geburts-/Sterbedatum & -ort, Beruf, Notizen
- **Beziehungen abbilden**: Partnerschaften/Ehen, Eltern-Kind-Verknüpfungen (inkl. Adoption/Stiefkind)
- **Interaktiver Stammbaum**: zoom- und verschiebbare Baumansicht, Sprung zu jeder Person als neuer Mittelpunkt
- **Personensuche** über alle erfassten Personen
- **GEDCOM-Import/-Export**: Standardformat zum Austausch mit anderen Genealogie-Programmen
- **Mehrbenutzer-Login**: bis zu 5 Familienmitglieder-Konten mit gleichen Rechten
- **Helles, modernes Design** mit dezenten "Glow"-Akzenten, responsiv für Handy/Tablet/Desktop
- **Lokal & privat**: Daten bleiben als SQLite-Datei auf deinem Raspberry Pi, kein Cloud-Zwang

## Tech-Stack

Next.js 14 (App Router) · TypeScript · Prisma · SQLite · NextAuth · Tailwind CSS · Docker

---

## 1. Projekt in GitHub Codespaces vorbereiten

Da dein Raspberry Pi keine npm-Pakete aus dem Internet laden soll, erzeugst du
die Lock-Datei und die Datenbank-Migrationen einmalig in einer Umgebung mit
Internetzugang (z. B. GitHub Codespaces, wie du es bereits kennst):

```bash
npm install
npx prisma migrate dev --name init
```

Das erzeugt `package-lock.json` sowie den Ordner `prisma/migrations/`.
**Beides muss committet und gepusht werden** – ohne sie schlägt der Docker-Build fehl.

```bash
git add package-lock.json prisma/migrations
git commit -m "Lockfile und initiale Migration"
git push
```

## 2. Automatischer Build über GitHub Actions

Bei jedem Push auf `main` baut die Pipeline (`.github/workflows/docker-build.yml`)
automatisch ein Multi-Arch-Image (passend für Raspberry Pi/ARM64 **und** normale
PCs/AMD64) und veröffentlicht es nach `ghcr.io/<dein-github-name>/familienstammbaum:latest`.

> ⚠️ **Wichtig:** GitHub-Benutzernamen mit Großbuchstaben (z. B. `Torben0589`)
> müssen im Image-Pfad **klein geschrieben** werden (`torben0589`). Die Pipeline
> erledigt das automatisch; achte aber darauf, dass du in `deploy/pi/docker-compose.yml`
> ebenfalls den kleingeschriebenen Namen einträgst.

Nach dem ersten Push: Prüfe unter GitHub → *Packages*, ob das Image erfolgreich
veröffentlicht wurde, bevor du mit Schritt 3 weitermachst.

## 3. Auf dem Raspberry Pi einrichten

```bash
mkdir -p ~/Familienstammbaum && cd ~/Familienstammbaum
# deploy/pi/docker-compose.yml und deploy/pi/.env.example von GitHub herunterladen
# (z. B. per scp, git clone --depth 1, oder manuell kopieren)

cp .env.example .env
nano .env   # NEXTAUTH_SECRET setzen, siehe unten

mkdir -p data
docker compose pull
docker compose up -d
```

Ein sicheres Secret erzeugst du mit:

```bash
openssl rand -base64 32
```

Trage das Ergebnis als `NEXTAUTH_SECRET` in die `.env`-Datei ein. `NEXTAUTH_URL`
sollte die Adresse sein, unter der ihr die App erreicht (z. B.
`http://raspberrypi.local:3000` im Heimnetz).

## 4. Erste Einrichtung in der App

Rufe die App im Browser auf (z. B. `http://raspberrypi.local:3000`). Da noch
kein Benutzerkonto existiert, landest du automatisch auf der Einrichtungsseite
und legst dein erstes Konto an. Weitere Familienmitglieder (bis zu 5, alle mit
gleichen Rechten) fügst du anschließend unter **Einstellungen** hinzu.

## 5. Zugriff von anderen Geräten / per VPN

- **Im Heimnetz**: einfach `http://raspberrypi.local:3000` (oder die IP des Pi) aufrufen.
- **Von unterwegs**: über euer bestehendes VPN (z. B. FritzBox-VPN) auf das Heimnetz
  verbinden und dieselbe Adresse nutzen. Jeder Zugriff erfordert weiterhin die
  Zugangsdaten aus Schritt 4 – es ist also kein zusätzlicher Schutz nötig, aber
  ein VPN verhindert, dass der Port überhaupt aus dem offenen Internet erreichbar ist.
- Vom Port direkt ins Internet weiterzuleiten (Port-Forwarding) wird **nicht empfohlen**,
  solange keine zusätzliche HTTPS-Absicherung (z. B. Reverse-Proxy mit Let's-Encrypt-Zertifikat)
  eingerichtet ist.

## 6. GEDCOM-Import/-Export

Unter **Einstellungen** könnt ihr jederzeit:
- euren kompletten Stammbaum als `.ged`-Datei **exportieren** (Backup oder Umzug zu
  einem anderen Programm wie Ahnenblatt, MyHeritage, etc.)
- eine bestehende `.ged`-Datei **importieren**, um Daten aus einem anderen Programm zu übernehmen

## Updates einspielen

Dank des optionalen Watchtower-Dienstes in `docker-compose.yml` prüft der Pi
täglich automatisch auf ein neues Image und aktualisiert sich selbst. Manuell geht es mit:

```bash
docker compose pull
docker compose up -d
```

Den aktuell laufenden Stand (Commit + Build-Zeitpunkt) siehst du in der
`VERSION.md` im Repository, die bei jedem Build automatisch aktualisiert wird.

## Datenbank-Backup

Die komplette Datenbank liegt als einzelne Datei unter `./data/familienstammbaum.db`
auf dem Pi. Für ein Backup reicht es, diese Datei (z. B. bei gestopptem Container)
zu kopieren:

```bash
docker compose stop familienstammbaum
cp data/familienstammbaum.db ~/backup-stammbaum-$(date +%F).db
docker compose start familienstammbaum
```

## Bekannte Grenzen (Version 1)

- Das Baum-Layout zentriert Kinder automatisch unter ihren Eltern; bei sehr
  verzweigten Mehrfachehen kann die Anordnung in Einzelfällen unübersichtlich
  werden – ein Wechsel des "Mittelpunkts" (Personensuche über der Baumansicht)
  hilft meist weiter.
- Foto-Upload ist in dieser Version bewusst noch nicht enthalten (Datenbankfeld
  ist aber bereits vorbereitet, falls ihr das später ergänzen möchtet).
