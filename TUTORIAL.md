# Webseite aktualisieren und starten

Öffne PowerShell im Ordner der Webseite.

## 1. Neueste Version herunterladen

```powershell
git pull
```

## 2. Abhängigkeiten aktualisieren

```powershell
pnpm install
```

## 3. Webseite starten

```powershell
pnpm dev
```

Die Webseite ist danach unter [http://localhost:3001](http://localhost:3001) erreichbar.

## Webseite beenden

Klicke in das PowerShell-Fenster und drücke:

```text
Strg + C
```

Wenn PowerShell nach einer Bestätigung fragt, drücke zusätzlich `J` und danach `Enter`.

## Kurzfassung

```powershell
git pull
pnpm install
pnpm dev
```

Zum Beenden: `Strg + C`
