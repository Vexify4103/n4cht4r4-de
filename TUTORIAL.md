# N4cht4r4-Webseite lokal testen und aktualisieren

Diese Anleitung ist für Personen gedacht, die die Webseite nur lokal testen möchten. Du musst dafür nichts programmieren und keine Änderungen zu GitHub hochladen.

## Voraussetzungen

Installiert sein müssen:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download)
- eine Internetverbindung

Das GitHub-Repository ist öffentlich. Zum Herunterladen und Aktualisieren ist deshalb keine GitHub-Anmeldung notwendig.

## 1. Webseite zum ersten Mal herunterladen

Erstelle zuerst einen **leeren Ordner**, in dem die Webseite gespeichert werden soll. Öffne anschließend PowerShell in diesem Ordner.

Prüfe mit diesem Befehl, ob der Ordner wirklich leer ist:

```powershell
Get-ChildItem -Force
```

Wenn nichts angezeigt wird, kannst du das Projekt direkt in diesen Ordner herunterladen:

```powershell
git clone https://github.com/Vexify4103/n4cht4r4-de.git .
```

Der Punkt am Ende ist wichtig. Er bedeutet, dass Git die Dateien in den aktuell geöffneten Ordner legt.

## 2. pnpm installieren

Das Projekt verwendet `pnpm`. Die benötigte Version kann einmalig mit npm installiert werden:

```powershell
npm install --global pnpm@10.12.1
```

Prüfe danach die Installation:

```powershell
pnpm --version
```

## 3. Abhängigkeiten installieren

Führe im Projektordner diesen Befehl aus:

```powershell
pnpm install
```

Die Installation kann beim ersten Mal einige Minuten dauern.

## 4. Private Einstellungen einfügen

Die Datei `.env.local` enthält private Zugangsdaten und wird deshalb **niemals über GitHub verteilt**.

Du erhältst diese Datei separat vom Entwickler. Lege sie direkt in den Projektordner, also in denselben Ordner wie `package.json`.

Die Datei darf nicht umbenannt, auf GitHub hochgeladen oder öffentlich geteilt werden.

## 5. Webseite starten

```powershell
pnpm dev
```

Danach erreichst du die Webseite unter:

[http://localhost:3001](http://localhost:3001)

Lasse das PowerShell-Fenster geöffnet, solange du die Webseite testest. Zum Beenden drückst du im Fenster:

```text
Strg + C
```

## Später die neueste Version laden

Öffne PowerShell wieder im Projektordner. Falls die Webseite noch läuft, beende sie zuerst mit `Strg + C`.

Führe anschließend nacheinander aus:

```powershell
git status
git pull --ff-only
pnpm install
pnpm dev
```

### Bedeutung der Befehle

- `git status` zeigt, ob lokale Dateien verändert wurden.
- `git pull --ff-only` lädt ausschließlich die neuesten freigegebenen Änderungen von GitHub.
- `pnpm install` installiert neue oder geänderte Abhängigkeiten. Der Befehl ist auch dann sicher, wenn nichts geändert wurde.
- `pnpm dev` startet die aktualisierte Webseite wieder auf Port `3001`.

Wenn Git `Already up to date.` anzeigt, ist bereits die neueste Version installiert.

## Wichtig bei lokalen Änderungen

Wenn `git status` Dateien unter `modified`, `deleted` oder `untracked files` auflistet, führe keine Lösch- oder Reset-Befehle aus. Schicke dem Entwickler stattdessen einen Screenshot der Ausgabe. So gehen keine lokalen Dateien versehentlich verloren.

Die Datei `.env.local` wird von Git ignoriert und bleibt beim Aktualisieren erhalten.

## Häufige Probleme

### `pnpm` wurde nicht gefunden

Installiere pnpm erneut und öffne PowerShell danach neu:

```powershell
npm install --global pnpm@10.12.1
```

### Port `3001` wird bereits verwendet

Meist läuft die Webseite noch in einem anderen PowerShell-Fenster. Suche dieses Fenster und beende den Server dort mit `Strg + C`. Starte danach erneut:

```powershell
pnpm dev
```

### Git kann nicht aktualisieren

Führe diese beiden Befehle aus und schicke die vollständige Ausgabe an den Entwickler:

```powershell
git status
git remote -v
```

Private Zugangsdaten oder den Inhalt von `.env.local` niemals mitsenden.
