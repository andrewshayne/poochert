# Poochert 🐾

**Poochert** is a high-performance, full-stack web application designed to showcase beautiful, chronological virtualized timelines of dog photos. Built for speed and seamless exploration, it features a horizontal virtualized gallery that dynamically scales to fit each dog's unique photo history, complete with secure administrative controls for asset management.

---

## 🚀 Intent & Features

*   **Virtualized Horizontal Timeline:** Powered by `@tanstack/react-virtual`, rendering hundreds of photos smoothly at 60 FPS without layout or performance degradation.
*   **Dynamic Date Scaling:** Automatically calculates the active timeline range based on the oldest photo in the database up to the present day.
*   **Edge-Powered Backend:** Built on **Cloudflare Workers** for low-latency global delivery and secure serverless API routing.
*   **Object & Database Storage:** Leverages **Cloudflare R2** for binary image storage and **Cloudflare D1 (SQLite)** for fast relational metadata storage.
*   **Protected Admin Suite:**
    *   Secure password authentication verified at the edge.
    *   Drag-and-drop multi-file uploading directly into R2 and D1.
    *   Inline photo metadata editing (dates and captions).
    *   Secure deletion workflow removing both database records and raw R2 objects with confirmation prompts.

---

## 🧰 Tech Stack

*   **Frontend:** React, Vite, `@tanstack/react-virtual`, Vanilla CSS (inline/modular styling)
*   **Backend / Runtime:** Cloudflare Workers (ES Modules)
*   **Database:** Cloudflare D1 (SQLite)
*   **Storage:** Cloudflare R2 Object Storage

---

## ⚙️ Useful Commands

Here are the standard commands for developing, managing, and deploying this project using **Wrangler** (Cloudflare's CLI):

### Development

*   **Run local development server (Workers + Assets):**
    ```bash
    npx wrangler dev
    ```
*   **Run Vite frontend standalone (if applicable for UI tweaking):**
    ```bash
    npm run dev
    ```

### Database & Migrations (Cloudflare D1)

*   **Execute a local SQL query/migration:**
    ```bash
    npx wrangler d1 execute <DB_NAME> --local --command="SELECT * FROM photos;"
    ```
*   **Execute a production SQL migration:**
    ```bash
    npx wrangler d1 execute <DB_NAME> --remote --file=./schema.sql
    ```

### Deployment

*   **Deploy worker and static assets to Cloudflare:**
    ```bash
    npx wrangler deploy
    ```

---

## 🔒 Environment Secrets

To run this worker properly, make sure your Cloudflare secret is configured:

*   **Set the admin secret key:**
    ```bash
    npx wrangler secret put ADMIN_SECRET
    ```


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
