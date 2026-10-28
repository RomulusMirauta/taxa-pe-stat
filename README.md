# Ceasul leului

Calculator pentru cât pierd economiile în lei din cauza inflației și a deprecierii față de EUR și USD, pe zi, săptămână, lună și an.

## Fișiere

| Fișier | Rol |
|---|---|
| `app.html` | **Sursa unică a aplicației.** Același fișier rulează local și e publicat ca artifact. |
| `serve.mjs` | Server local fără dependențe (Node). Învelește `app.html` în scheletul artifact-ului și reîncarcă pagina când salvezi. |
| `start.cmd` | Dublu-click pe Windows: pornește serverul și deschide browserul. |
| `artifact.json` | Linkul artifact-ului publicat și ultima versiune. |
| `BAZA.md` | Baza proiectului: date, cauze, formule, exemplu calculat, limite, pași următori. |

## Rulare locală

Dublu-click pe `start.cmd`, sau din terminal:

```
node serve.mjs
```

Apoi deschide http://localhost:5173. Alt port: `set PORT=8080 && node serve.mjs`.

## Reguli pentru `app.html`

Fișierul e un fragment, fără `<!doctype>`, `<html>`, `<head>` sau `<body>`: artifact-ul și `serve.mjs` adaugă scheletul.

- Scripturi externe doar de pe cdnjs, jsDelivr, unpkg; fonturi doar de pe Google Fonts.
- Fără `fetch` către alte site-uri: în artifact sunt blocate. De aceea cursurile și inflația se introduc manual.
- Tot CSS-ul și JS-ul stau în același fișier.

## Update la artifact

După ce modifici `app.html` local, spune-i lui Claude: **„sync CeasulLeului”**. Claude citește `app.html` din folder, îl publică peste același link din `artifact.json` și actualizează versiunea.

Merge și invers: dacă modificăm aplicația în chat, Claude scrie noul `app.html` aici.
