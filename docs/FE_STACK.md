# Ari Frontend Stack

This is a summary of the frontend plus backend-for-frontend stack that shows up across `starmeme`, `starscreen`, `astrime`, and `minty`, in the order they appear to have been implemented:

1. `starmeme`
2. `starscreen`
3. `astrime`
4. `minty`

The short version: the Ari frontend stack is not a React/Vite/SPA stack. It is a pragmatic, server-rendered Node app stack built around Express, EJS, hand-written CSS, vanilla browser JavaScript, SQLite/libSQL, Google OAuth, and feature-specific third-party APIs. The apps tend to ship as complete products with real authentication, data ownership, domain-specific workflows, admin or support surfaces, docs, and deployment paths, while avoiding frontend build complexity unless a specific product need demands it.

## Executive Summary

The recurring choices are:

- **Node.js plus Express as the app shell**: Express owns routing, auth, API endpoints, view rendering, static assets, uploads, and deployment entrypoints.
- **EJS as the frontend framework**: Pages are server-rendered templates. Client-side JavaScript is added selectively for interactivity.
- **Backend-for-frontend in one deployable app**: The server provides both HTML views and JSON endpoints tailored to those views.
- **SQLite first, Turso/libSQL when production hosting needs it**: Local development uses file-backed SQLite. Newer projects increasingly support Turso/libSQL for hosted/serverless production.
- **Google OAuth via Passport**: Authentication is consistently delegated to Google OAuth with session-backed login.
- **Plain CSS or Tailwind CDN, no compile step**: Styling is direct and inspectable. Later projects move toward design tokens and a documented visual system.
- **Vanilla JS for product interactions**: Fetch calls, DOM rendering, modals, dropdowns, pagination, filters, canvas tools, and extension flows are written directly in browser JS.
- **Real workflows over framework purity**: The stack optimizes for getting a usable app online: uploads, payments, browser extensions, charts, canvas annotation, Plaid sync, AI categorization, tenancy, admin screens, and docs.

## The Core Stack

| Layer | Common Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js | All four apps are Node applications. |
| Web framework | Express | Express remains the primary routing and middleware layer. |
| Rendering | EJS | Server-rendered pages are the default UI primitive. |
| Layouts/partials | EJS includes, later `ejs-mate` | Shared nav, head, footer, and page shells become more formal over time. |
| Client JS | Vanilla JavaScript | No persistent SPA framework. Interactivity is localized to specific pages. |
| CSS | Plain CSS, plus Tailwind CDN in StarScreen | Styling is mostly global CSS files and template classes, not CSS-in-JS or component libraries. |
| Auth | Passport + Google OAuth 2.0 | Used across the apps, generally with session persistence. |
| Session storage | Express session, then SQLite/libSQL-backed sessions | Session durability improves as apps mature. |
| Data | SQLite, later Turso/libSQL | Schema is close to the app and initialized/migrated by app code. |
| APIs | View-specific JSON endpoints | The same Express app serves pages and the JSON endpoints used by those pages. |
| Assets | `public/`, `uploads/`, extension assets | Static assets are simple folders, often with user-generated uploads. |
| Deployment | VPS/GitHub Actions early; Vercel/Turso later | Deployment choices follow product constraints more than framework ideology. |
| Tests | Minimal early, better later | StarScreen and AstriMe include Jest/Supertest. Minty currently emphasizes implementation/docs more than test scaffolding. |

## Architectural Shape

### Server-rendered product apps

The basic shape is:

```text
server.js or app.js
src/server.js
src/routes/*
src/middlewares/*
src/db/*
views/*.ejs
views/partials/*.ejs
public/styles.css
public/*.js
```

The browser receives complete HTML pages from EJS templates. JavaScript is added where the page needs richer behavior: canvas manipulation, dashboard filters, table sorting, modals, fetch-based updates, or copy-to-clipboard affordances.

The server is not a separate generic API consumed by a separate frontend app. It is a BFF: it knows exactly which templates, session state, upload paths, and JSON endpoints the product needs.

### One app owns the full product surface

These projects usually include:

- marketing or public pages
- login/logout
- authenticated dashboard views
- JSON endpoints backing those dashboard views
- user-specific data ownership
- admin, support, privacy, or billing pages where relevant
- deployment docs or product planning docs

That makes each repo feel like a complete small SaaS/product rather than a frontend demo.

### Progressive modularity

There is a clear evolution from monolith to modular app factory:

- `starmeme`: single large `app.js` with routes, auth, uploads, image work, and rendering in one place.
- `starscreen`: `createApp()` in `src/server.js`, route modules, middleware modules, utilities, migrations, and dependency injection for tests.
- `astrime`: a compact monolith again, but with `ejs-mate` layout support, Promise-based DB helpers, Turso/Vercel handling, and tests.
- `minty`: modular `src/server.js` again, route modules by domain, libSQL wrapper, session store, and API-heavy frontend pages.

The direction is not "maximum abstraction." It is "start simple, split when the product earns it."

## Frontend Philosophy

### EJS instead of SPA

The strongest pattern is choosing EJS where many developers might reach for React. This gives:

- fast page construction
- direct access to session/user state
- simple deployment
- no frontend bundler
- less split-brain between frontend and backend routes
- easy iteration on small tools and internal SaaS-like products

The cost is that client-side interactions are less componentized. As pages become more interactive, the vanilla JS files start acting like local page controllers.

### Vanilla JS as page controllers

Client-side code is used when the server-rendered page needs richer behavior:

- StarMeme: meme creation previews, template selection, uploads, image description helpers.
- StarScreen: delete buttons, billing checkout fetches, service worker registration, Fabric.js annotation canvas.
- AstriMe: segmented controls, dropdown action menus, QR modal, copy/delete actions.
- Minty: transaction table rendering, pagination, sorting, search debounce, account filters, category dropdowns, Chart.js dashboard rendering, toasts, sync button states.

This is a "sprinkles plus page controller" model. The page is server-rendered; the JS progressively enhances it into a working tool.

### Static assets stay simple

The apps use conventional folders:

```text
public/
uploads/
views/
extension/
```

There is little ceremony around asset pipelines. Product assets are checked into `public/`, generated/user content lands in `uploads/`, and browser extension assets live in `extension/`.

## Styling Choices

### StarMeme: utilitarian global CSS

StarMeme starts with direct global CSS:

- Arial/system-ish typography
- light gray backgrounds
- blue primary actions
- simple cards, fixed side navigation, basic forms
- explicit selectors for product-specific widgets like meme grids and template carousels

The style is functional and product-first. The CSS is organized by rough UI region rather than a formal design system.

### StarScreen: Tailwind CDN and utility-heavy templates

StarScreen shifts heavily toward Tailwind classes directly in EJS:

- Tailwind 2 CDN in templates
- `bg-gray-100`, `max-w-7xl`, `rounded-lg`, `shadow`, `grid`, `space-x-*`, etc.
- small custom CSS file for screenshot cropping
- inline styles for the annotation toolbar

This makes pages quick to assemble and reasonably polished without building a local design system. The tradeoff is that visual decisions are scattered across templates.

### AstriMe: custom design language with CSS variables

AstriMe is where the styling starts to feel more systematic:

- `:root` CSS tokens for background, text, border, card, primary, shadow
- Inter font loaded in the layout
- sticky glass-ish header
- cards, tables, buttons, badges, dropdown menus, modals
- consistent max-width containers
- cleaner SaaS/dashboard visual language

The UI becomes less generic and more brandable. It still avoids a framework, but the CSS begins to work like a small design system.

### Minty: documented design system

Minty is the clearest expression of a mature Ari visual stack:

- explicit design tokens in CSS
- documented design system in `docs/DESIGN_SYSTEM.md`
- brand/semantic colors
- typography roles: display, body, data
- spacing scale based on 8px increments
- surface, shadow, radius, focus-ring tokens
- page-specific density guidance for transactions and budgeting
- category palette for charts and badges

Minty also reflects a stronger product-design split: dense, workhorse transaction tables for repeated use; more editorial, summary-oriented dashboard cards/charts for analysis.

## Backend-for-Frontend Patterns

### Auth and session state

Google OAuth via Passport is a near-constant:

- user identity comes from Google
- sessions keep the app simple after login
- templates receive user/session data through `res.locals` or render locals
- protected pages use middleware such as `isLoggedIn`/`ensureAuth`

The session story gets more robust over time:

- StarMeme uses basic `express-session`.
- StarScreen stores sessions in SQLite with `connect-sqlite3` and has a test session store.
- AstriMe uses persistent session cookies and preview-login handling for Vercel previews.
- Minty uses a custom `LibSQLStore`, aligning session storage with Turso/libSQL production data.

### Data persistence

SQLite is the default database because it matches the product scale and keeps deployment simple:

- StarMeme: `sqlite3` with table initialization in `db.js`.
- StarScreen: `sqlite3` plus migration modules.
- AstriMe: `sqlite3` locally, `@libsql/client` for Turso, migration tracking.
- Minty: `@libsql/client` everywhere, using local `file:` URLs in development and Turso credentials in production.

The schema is usually not hidden behind a heavy ORM. SQL is written directly, with light helper wrappers.

### Migrations are pragmatic

Schema evolution is handled close to the app:

- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN` wrapped to tolerate already-applied changes
- migration files in later projects
- a `_migrations` table in AstriMe
- startup-time migrations in Minty

This favors operational simplicity over a full migration framework.

### APIs are tailored to pages

The JSON endpoints are small, product-specific, and live beside rendered routes:

- StarMeme: image description and meme/template workflows.
- StarScreen: uploads, screenshot deletion, token issuance, billing checkout, annotation saves.
- AstriMe: link creation, deletion, QR code generation, JSON behavior for extension/API consumers.
- Minty: Plaid linking, transaction sync, transaction updates, category CRUD, dashboard data.

There is no attempt to create a generic public API layer unless a browser extension or integration needs it.

## Product Integration Pattern

Each app introduces one or two domain-specific integrations and keeps the rest of the stack stable.

| App | Product Domain | Main Integrations |
| --- | --- | --- |
| StarMeme | Meme generation and sharing | Image/GIF processing, uploads, OpenAI image/text helpers |
| StarScreen | Screenshot capture and annotation | Chrome extension, PWA manifest/service worker, Fabric.js canvas, Stripe billing |
| AstriMe | URL shortening | Chrome extension, QR code generation, Turso/Vercel preview support |
| Minty | Personal finance | Plaid, OpenAI categorization, Chart.js, Turso/libSQL |

The pattern is: keep the core app stack boring, then spend complexity budget only on the domain-specific part.

## Project-by-Project Notes

### StarMeme

StarMeme is the earliest and most monolithic example.

Stack traits:

- CommonJS
- `app.js` as the central server
- Express + EJS
- `sqlite3`
- Passport Google OAuth
- `multer` uploads
- filesystem-backed generated assets
- image/GIF handling with canvas/GIF libraries
- global `public/styles.css`
- tenant helpers split into `tenant.js`, but most product logic remains in `app.js`

Product traits:

- authenticated company meme creation
- templates and generated memes
- voting/comments
- tenant isolation by email domain
- admin concept via tenant code
- public marketing pages
- docs around completed features and future improvements

What it says about the stack:

StarMeme prioritizes shipping a working product with minimal structure. It shows the base Ari pattern: one Express app, EJS pages, SQLite, local uploads, vanilla CSS, and just enough modularity to keep tenant logic separate.

### StarScreen

StarScreen is a major step up in product and code organization.

Stack traits:

- ES modules with `"type": "module"`
- `server.js` CLI wrapper plus `src/server.js` app factory
- route modules under `src/routes`
- middleware modules under `src/middlewares`
- migration modules under `src/db/migrations`
- utility modules under `src/utils`
- SQLite-backed sessions
- Jest/Supertest tests
- Tailwind CDN in EJS templates
- Fabric.js for annotation
- Chrome extension and PWA assets
- GitHub Actions for CI, deploy, and preview deploy

Product traits:

- screenshot upload/capture
- dashboard grid
- private/public visibility controls
- protected uploaded files
- annotation canvas
- manual upload
- tenant assignment and quota
- admin usage page
- Stripe billing
- browser extension
- service worker/manifest

What it says about the stack:

StarScreen shows the Ari stack becoming testable and modular. The BFF shape remains, but the server is now organized as a real app with injectable dependencies. UI construction leans on Tailwind CDN for speed rather than a custom CSS system.

### AstriMe

AstriMe is smaller in scope but more refined in UI and deployment adaptation.

Stack traits:

- CommonJS
- Express + EJS + `ejs-mate` layouts
- `sqlite3` locally
- `@libsql/client` for Turso
- Google OAuth
- persistent sessions
- preview-login support for Vercel preview environments
- Jest/Supertest tests
- custom CSS variables
- Inter typography
- vanilla JS for menus, QR modal, copy/delete, segmented controls
- Chrome extension

Product traits:

- public landing page
- authenticated dashboard
- random/custom short links
- click tracking
- public search
- QR code generation
- browser extension
- reserved slug handling

What it says about the stack:

AstriMe shows a cleaner design vocabulary and better deployment portability. It is intentionally compact, but not primitive. The app handles Vercel/Turso constraints without switching to Next.js or a SPA framework.

### Minty

Minty is the most recent and most mature expression of the stack.

Stack traits:

- ES modules
- Express 5
- `createApp()` in `src/server.js`
- route modules for auth, Plaid, categories, and transactions
- `@libsql/client` as the DB layer
- custom libSQL session store
- Vercel entrypoint in `api/index.js`
- Vercel rewrite config
- no frontend build step
- server-rendered EJS shells
- vanilla JS for rich pages
- Chart.js for charts
- documented CSS design system

Product traits:

- Google OAuth
- Plaid account linking
- transaction sync
- auto-categorization through OpenAI
- user-defined categories
- transaction table with search, sort, pagination, notes, account filtering, exclusions
- budgeting dashboard with date ranges, charts, category sections, totals
- settings/setup flows

What it says about the stack:

Minty keeps the same basic architecture but is much more product-systematic. It has a documented visual language, richer browser-side state, and a more serverless-ready database/session story. It is still recognizably an Express/EJS app, but it behaves more like a complete SaaS dashboard.

## Evolution Over Time

### 1. From monolith to modular app factory

StarMeme starts with almost everything in `app.js`. StarScreen introduces the `createApp()` pattern and separates routes/middleware/utils. AstriMe uses a compact monolith because the product is narrower, but brings stronger layout and deployment patterns. Minty returns to the modular app factory with cleaner route boundaries.

The evolution is pragmatic: structure appears when complexity justifies it.

### 2. From plain CSS to design systems

Styling moves through four phases:

1. **StarMeme**: global CSS, simple cards/forms/nav, utilitarian blue/gray theme.
2. **StarScreen**: Tailwind CDN utilities for rapid page building.
3. **AstriMe**: custom CSS variables, Inter, reusable button/card/table/modal patterns.
4. **Minty**: explicit design tokens and a written design system, including color, typography, spacing, radii, shadows, and page-specific UI patterns.

The trend is toward stronger design consistency without adopting a frontend build pipeline.

### 3. From static pages to interactive workbenches

Interactivity gets deeper over time:

- StarMeme: interactive creation flow around images/templates.
- StarScreen: annotation canvas and screenshot dashboard.
- AstriMe: dashboard affordances like QR modal and action menus.
- Minty: full data workbench with filtering, sorting, pagination, charting, sync, inline edits, notes, categories, and toasts.

The frontend remains vanilla JS, but the complexity of page controllers increases.

### 4. From local VPS assumptions to serverless-compatible hosting

Deployment evolves:

- StarMeme reads like a manually managed VPS deployment.
- StarScreen has GitHub Actions deploy and preview workflows.
- AstriMe supports Turso and Vercel preview login flows.
- Minty has a Vercel entrypoint and rewrites, plus Turso/libSQL-oriented persistence.

The stack is moving from "single Node process on a server with local SQLite" toward "Express app deployable through Vercel with hosted libSQL."

### 5. From app-only data to user-owned data boundaries

Data ownership becomes more explicit:

- StarMeme adds tenants and global/local visibility.
- StarScreen uses tenant assignment, screenshot visibility, protected upload access, quotas, and admin views.
- AstriMe ties links to users.
- Minty is fully user-scoped across Plaid items, accounts, categories, and transactions.

Auth is not decorative. It is central to the data model.

### 6. From minimal testing to testable server boundaries

Testing grows unevenly but noticeably:

- StarMeme has little formal test setup.
- StarScreen has Jest/Supertest and explicit dependency injection for DB/upload paths/Stripe.
- AstriMe has Jest/Supertest and test login helpers.
- Minty currently has clearer modular boundaries than formal test coverage in the observed files.

The reusable `createApp(dbInstance)` pattern is the important architectural move because it makes tests and alternate runtimes possible.

## Signature Ari Patterns

### Boring core, interesting product edge

The repeated strategy is to keep the core stack low-ceremony, then integrate the specific product capability:

- memes need image/GIF processing
- screenshots need extension capture and canvas annotation
- links need slugs, QR codes, and extension copy flows
- finance needs Plaid, categorization, charts, and dense tables

### SQL close to the product

The apps use direct SQL rather than an ORM. This keeps schemas visible and lets the app encode product rules explicitly. The tradeoff is more manual migration and query handling.

### Sessions over token-heavy frontend auth

Authenticated browser flows use sessions. Tokens appear where needed, such as StarScreen extension/API flows, but the main web app stays session-based.

### Product routes over REST purity

Routes are named for workflows, not theoretical resource purity:

- `/dashboard`
- `/transactions`
- `/budgeting`
- `/templates/new`
- `/annotate/:uuid`
- `/billing/checkout`
- `/api/transactions/sync`

This fits the BFF model: the route shape mirrors the UI and user actions.

### Docs as product memory

The repos contain planning and implementation docs:

- StarMeme has `docs/done/*` and improvement docs.
- StarScreen has feature docs for multitenancy, link preview, and copy link behavior.
- Minty has design, manual import, budgeting, and old planning docs.

This suggests a workflow where product changes are specified and preserved in Markdown, not only encoded in commits.

## What This Stack Is Good At

This stack is especially good for:

- small-to-medium SaaS tools
- internal tools
- authenticated dashboards
- browser-extension companion apps
- upload-heavy workflows
- products with a few high-value integrations
- quick iteration without frontend build tooling
- apps where server-rendered HTML plus selective JS is enough
- deploying complete products as a single Node app

It is less naturally suited for:

- highly componentized design-system apps with many reusable frontend states
- offline-first SPAs
- complex collaborative real-time UIs
- frontend teams expecting React component boundaries
- apps requiring heavy client-side routing

## Likely Default Choice Today

Based on the direction from AstriMe to Minty, the current Ari default would probably be:

```text
Node.js
Express 5
ES modules
EJS templates
views/partials for head/nav/shared layout
public/styles.css with CSS variables/design tokens
public/*.js for page-specific controllers
SQLite locally
Turso/libSQL in production
custom libSQL session store
Passport Google OAuth
route modules under src/routes
middleware under src/middlewares
db init/migrations under src/db
Vercel entrypoint if serverless deployment is useful
Jest/Supertest when the app has enough risk or routing complexity
```

The frontend would likely avoid React unless there is a clear interaction reason. It would start with server-rendered EJS, build the real workflow first, and add vanilla JS or a focused library like Chart.js/Fabric.js only where the domain demands it.

## One-Sentence Definition

The Ari frontend stack is a full-stack, server-rendered Express/EJS product stack with vanilla-JS interactivity, SQLite/libSQL persistence, Google OAuth sessions, direct CSS design systems, and carefully chosen domain libraries, optimized for shipping complete, useful web tools without a frontend build pipeline.
