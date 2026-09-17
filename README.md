# NGA TaskMentor

Assignments, quizzes, grading and proctoring for NGA. Sign-in is through the
**NGA Central MIS** (single sign-on) — this app has no user accounts of its own.

```
server/       Express + TypeScript + Sequelize (MySQL)   → http://localhost:5002
client/       React + Vite                                → http://localhost:5174
live-server/  WebRTC signalling for live proctoring       → http://localhost:5003 (optional)
```

## Local development setup

### 1. Prerequisites

- **Node.js 20+** and npm
- **MySQL 8** running locally, and its root password
  (Windows: [MySQL Installer](https://dev.mysql.com/downloads/installer/) — pick
  "Server only"; macOS: `brew install mysql && brew services start mysql`)
- An **NGA MIS account** (you sign in with it) and the TaskMentor **SSO client
  secret** from the maintainer

### 2. Install

```bash
git clone https://github.com/niyongaboemmy/nga-task-mentor.git
cd nga-task-mentor
npm install
npm install --prefix server
npm install --prefix client
```

### 3. Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In `server/.env` set `DB_PASS` (your MySQL root password) and `SSO_CLIENT_SECRET`
(from the maintainer). The defaults for everything else work locally.

### 4. Create the database

Create an empty `taskmentor_dev` database, then load the sample data:

```bash
mysql -u root -p -e "CREATE DATABASE taskmentor_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p taskmentor_dev < server/taskmentor_dev.sql
```

(`mysql` is in MySQL's `bin` folder — on Windows, `C:\Program Files\MySQL\MySQL Server 8.0\bin`,
or use MySQL Workbench → Server → Data Import.) The sample data is optional: the
server creates any missing tables on start, but you'd begin with no quizzes.

### 5. Run

```bash
npm run dev      # server on :5002 and client on :5174, together
```

Open **http://localhost:5174** and click sign in — you're sent to the MIS login
page and back. For the proctoring module also run `npm run live-server`
(copy `live-server/.env.example` to `live-server/.env` first).

## Everyday commands

| Where | Command | What |
|---|---|---|
| root | `npm run dev` | server + client with reload |
| root | `npm run server` / `npm run client` / `npm run live-server` | one at a time |
| server | `npm test` | Jest tests |
| server | `npm run migrate` | apply pending Sequelize migrations (`migrations/`) |
| client | `npm test` / `npm run lint` / `npm run test:e2e` | client checks |

## Branching and deployment

**Every push to `main` deploys to production** (`.github/workflows/deploy.yml`).
Never commit directly on `main`:

```bash
git checkout -b feature/short-description
# ...work, verify locally...
git push -u origin feature/short-description   # then open a Pull Request
```

`main` changes only by merging a reviewed PR.

## More

- `SSO_CLIENT_INTEGRATION.md` — how sign-in via the MIS works
- `PROCTORING_DOCUMENTATION.md` — proctoring module
- `SYSTEM_FEATURES_GUIDE.md`, `DOCUMENTATION.md` — feature guides
- `server/DEPLOYMENT_GUIDE_CPANEL.md` — production hosting notes
