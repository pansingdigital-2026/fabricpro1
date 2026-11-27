# Fabric-Pro — Simple Guide

Two parts: **A) Put the site on Hostinger**, **B) Use the admin**.

---

## A) Deploy to Hostinger

### 1. Create the MySQL database

In Hostinger: **Databases → MySQL Databases → Create**. Write down:
database name, user, password, and host (usually `localhost`).

### 2. Create the tables and load your Fabric-Pro content

Open **phpMyAdmin** for that database → **SQL** tab:

1. Open `db/mysql/0001_schema.sql`, copy everything, paste it, and press **Go**.
2. Open `db/mysql/0002_fabricpro_content.sql`, copy everything, paste it, and press **Go**.
   This loads your Fabric-Pro logo, settings, menus, homepage layout, 12 textile categories, 32 tags, About page, and all 7 existing Fabric-Pro articles.

### 3. Deploy the Node.js app from GitHub (`fabricpro1`)

Hostinger → **Websites → fabric-pro.com → Node.js app** (Deploy from GitHub `fabricpro1`):

- **Node.js version:** 22
- **Install command:** `npm install`
- **Build command:** `npm run build`
- **Start command:** `npm start`
- **App root:** the project folder (where `package.json` is)

### 4. Environment variables

Add these in Hostinger (Environment variables section):

| Name | Example / meaning |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | your MySQL user |
| `DB_PASSWORD` | your MySQL password |
| `DB_NAME` | your database name |
| `SESSION_SECRET` | a long random string, 32+ characters |
| `UPLOAD_DIR` | `./uploads` |
| `ADMIN_EMAIL` | the email you'll log in with |
| `ADMIN_PASSWORD` | your first admin password |
| `NODE_ENV` | `production` |

### 5. Deploy and check

Click Deploy. When it's live:

- Visit `https://fabric-pro.com/api/public/health` — it should show `database.ok: true`.
- Visit `https://fabric-pro.com/admin` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## B) Using the admin (day to day)

Go to `https://fabric-pro.com/admin` and log in.

- **Dashboard** — quick overview of your content.
- **Content** — all articles. Click **New** to write one or import a Word (`.docx`) file:
  1. Title and URL slug (auto-filled).
  2. Choose the type: **News**, **Blogs**, or **Insights**.
  3. Pick a featured image from the Media library.
  4. Write in the editor (toggle Rich Text / Markdown at the top).
  5. Use the **Readability** panel on the right — aim for green.
  6. Fill the **SEO** fields (meta title + description).
  7. For **News**: fill **Source name / Source URL** to display the source box.
  8. Set status to **Published** and Save.
- **News Automation** — toggle Auto-publish On/Off and review automated News drafts.
- **Media** — upload images into **Branding**, **News**, **Blogs**, and **Insights** folders.
- **Categories & tags** — manage Fabric-Pro's 12 textile categories and 32 approved tags.
- **Authors** — writer profiles (photo, bio, LinkedIn links).
- **Homepage** — drag sections up/down, switch them on/off, and choose how many articles each shows.
- **Pages** — edit About or build new pages and add them to the menu.
- **Settings** — logo, colours, fonts (desktop & mobile), header style, footer, social links, GA4, and SEO.

Changes are live the moment you save — no redeploy needed.