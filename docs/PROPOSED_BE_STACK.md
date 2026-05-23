# Proposed Ari Backend Stacks

This document proposes backend stacks in Python and Go that are philosophically similar to the Ari frontend stack described in `FE_STACK.md`.

The goal is not to find the most fashionable backend stack. It is to identify stacks that preserve the same product-building posture:

- server-rendered by default
- one deployable app owns the product surface
- direct routes for real workflows
- SQLite first
- sessions over token-heavy browser auth
- handwritten SQL or very thin database layers
- plain templates, plain CSS, and vanilla browser JavaScript
- modularity only when the product earns it
- domain-specific libraries where they matter
- tests around routes, auth, persistence, and integrations when risk justifies them

## Executive Summary

The closest Python analogue is:

```text
Flask
Jinja2
Blueprints
static/ CSS and page-specific JS
SQLite
handwritten SQL or SQLAlchemy Core
Authlib for Google OAuth
Flask-Login or server-side sessions
pytest plus Flask test client
gunicorn or platform adapter for deployment
```

The closest Go analogue is:

```text
net/http
chi
html/template
static/ CSS and page-specific JS
database/sql
SQLite
handwritten SQL, optional sqlc later
golang.org/x/oauth2 for Google OAuth
gorilla/sessions or alexedwards/scs
httptest
single binary deployment
```

The short version:

- **Python default:** Flask + Jinja2 + SQLite.
- **Go default:** net/http + chi + html/template + SQLite.
- **Closest spiritual port of Express/EJS:** Flask.
- **Most Ari-compatible production shape:** Go with net/http, chi, direct SQL, and a single deployable binary.

## What "Ari-Compatible" Means

The Ari frontend stack is not really just a frontend stack. It is a full-stack product pattern built around Express, EJS, SQLite/libSQL, Google OAuth sessions, static assets, and small JSON endpoints that support server-rendered pages.

A backend stack that fits this philosophy should have the same instincts:

1. **HTML is a first-class response**

   The app should be comfortable rendering pages directly. JSON endpoints exist where the page needs richer behavior, not because the backend is trying to be a generic public API.

2. **The server is the product shell**

   Routing, auth, templates, static assets, uploads, admin pages, support pages, and workflow-specific APIs should live in one coherent app.

3. **SQLite is the default persistence layer**

   Local development should work with a file-backed database. Production can move to hosted SQLite-compatible services, Postgres, or another store when the product earns that complexity.

4. **SQL stays close to product logic**

   The schema should remain visible. Queries should usually be handwritten, lightly wrapped, or generated from SQL, rather than hidden behind a large ORM by default.

5. **Sessions are the normal browser auth model**

   Use Google OAuth to establish identity, then use durable server-side sessions or secure session cookies. API tokens are for extensions, integrations, or machine clients, not the main browser app.

6. **Frontend complexity is opt-in**

   Use templates, CSS, and vanilla JS. Add Chart.js, Fabric.js, HTMX, Alpine, or another focused library only when the product workflow needs it.

7. **Structure follows pressure**

   Start with a small app. Split into modules, blueprints, packages, services, or generated query layers when route count, testing needs, or integration complexity justify it.

## Python Stack

### Recommended Default

```text
Runtime: Python 3.12+
Web framework: Flask
Rendering: Jinja2
Routing modules: Flask Blueprints
Static assets: static/
Templates: templates/
Database: SQLite
DB access: sqlite3, SQLAlchemy Core, or tiny repository modules
Migrations: startup pragmatism first; Alembic only if SQLAlchemy is already in use
Auth: Authlib Google OAuth
Sessions: Flask session, Flask-Session, or Flask-Login plus server-side store
Tests: pytest, Flask test client
Deployment: gunicorn, uvicorn worker if needed, VPS, Render, Fly.io, Railway, or platform adapter
```

### Why Flask Fits

Flask is the Python stack that most closely matches Express/EJS:

- small core
- template-native
- route-first mental model
- static files and server-rendered pages are normal
- app factory pattern is common
- Blueprints map cleanly to Ari-style route modules
- tests can instantiate the app with alternate config and temporary databases
- extensions are opt-in rather than imposed by the framework

An Ari-style Flask app would look like this:

```text
app.py
src/
  __init__.py
  app.py
  auth.py
  db.py
  routes/
    dashboard.py
    transactions.py
    admin.py
  services/
    plaid.py
    categorization.py
  migrations/
    001_init.sql
templates/
  base.html
  partials/
  dashboard.html
  transactions.html
static/
  styles.css
  dashboard.js
  transactions.js
tests/
  test_auth.py
  test_routes.py
  test_transactions.py
```

### Database Style

The default should be direct SQL, not a large ORM-first domain model.

Good default:

```text
sqlite3 connection helper
schema.sql
migrations/*.sql
small query functions grouped by product area
```

Also acceptable:

```text
SQLAlchemy Core
Alembic migrations
no heavy ORM entity graph unless the product clearly benefits
```

Avoid by default:

```text
large ORM model hierarchy
automatic admin-first data modeling
generic repository abstraction before the queries need it
```

### Auth and Sessions

The Ari-compatible path is:

```text
Authlib Google OAuth
server-side session or signed cookie session
Flask-Login for current_user ergonomics
user loaded into template context
route decorators for login-required pages
```

This preserves the same shape as Passport Google OAuth plus Express sessions: OAuth establishes identity, the web app stays session-backed, and templates receive the current user directly.

### Migrations

Start with boring migrations:

```text
schema.sql
CREATE TABLE IF NOT EXISTS
ALTER TABLE guarded by migration records
_migrations table
```

Move to Alembic only when:

- the schema is changing often
- multiple environments need reliable upgrades
- SQLAlchemy is already present
- manual migration bookkeeping has become a source of mistakes

### Testing

The Flask app should use an app factory from the beginning if the product has auth, persistence, uploads, billing, or third-party integrations.

Test shape:

```text
create_app(test_config)
temporary SQLite database
test login helper
mock OAuth/integration clients
Flask test client for rendered pages and JSON endpoints
```

This is the Python equivalent of the Ari `createApp(dbInstance)` pattern from the more mature Node apps.

### When FastAPI Is a Better Fit

FastAPI can work with Jinja2 templates, but it is not the closest philosophical default. Its center of gravity is typed APIs, OpenAPI, Pydantic models, async endpoints, and JSON services.

Choose FastAPI when:

- the product is API-first
- OpenAPI documentation is a core deliverable
- typed request/response validation matters more than template ergonomics
- async integration fan-out is central to the workload

If using FastAPI in an Ari-compatible way, keep it restrained:

```text
FastAPI
Jinja2Templates
StaticFiles
SQLite via a small db layer
session middleware
OAuth through Authlib or Starlette-compatible helpers
vanilla JS and plain CSS
```

### Why Not Django By Default

Django is excellent, but it is less philosophically similar to the current Ari stack.

It brings:

- ORM-first modeling
- built-in admin
- apps as a stronger project architecture
- forms, permissions, middleware, settings, and conventions
- a larger framework surface

Use Django when the product wants those things:

- admin workflows are central
- CRUD-heavy internal systems
- complex permission models
- relational data modeling benefits from the ORM
- a larger team benefits from Django conventions

Do not use Django just to render templates with SQLite. Flask is closer to the Ari stack's current center of gravity.

## Go Stack

### Recommended Default

```text
Runtime: Go 1.22+
Web framework: net/http plus chi
Rendering: html/template
Routing modules: package-level handlers
Static assets: static/ served by http.FileServer
Templates: templates/
Database: SQLite through database/sql
DB access: handwritten SQL, optional sqlc once queries grow
Migrations: goose, tern, or tiny migration runner
Auth: golang.org/x/oauth2 with Google provider config
Sessions: gorilla/sessions, alexedwards/scs, or a small custom SQLite-backed store
Tests: testing plus httptest
Deployment: single binary, Docker, VPS, Fly.io, Render, Railway
```

### Why Go Fits

Go is a strong backend expression of the Ari philosophy because it naturally favors:

- explicit routing
- standard library HTTP
- simple deployment
- direct SQL
- small dependency graphs
- testable handlers
- plain templates
- single-binary products

An Ari-style Go app would look like this:

```text
cmd/
  app/
    main.go
internal/
  server/
    server.go
    routes.go
    middleware.go
  handlers/
    auth.go
    dashboard.go
    transactions.go
    admin.go
  db/
    db.go
    migrations/
      001_init.sql
  services/
    plaid.go
    categorization.go
templates/
  base.html
  partials/
  dashboard.html
  transactions.html
static/
  styles.css
  dashboard.js
  transactions.js
tests or *_test.go files beside packages
```

### Routing

Use `net/http` as the base and `chi` for routing ergonomics.

This keeps the app idiomatic:

```text
http.Handler
middleware as handler wrappers
route groups for authenticated/admin/product areas
standard httptest coverage
```

Avoid heavy Go web frameworks by default. They usually pull the app away from the Ari instinct of "standard pieces, composed plainly."

### Templates

Use `html/template` first.

Good pattern:

```text
parse templates at startup
base layout plus named blocks
partials for nav/head/forms/tables
template data structs per page
helper funcs for formatting
```

If template ergonomics become painful, consider `templ`, but only with a clear reason. Code generation is a real tradeoff, and the Ari stack generally avoids build steps unless the product need is strong.

### Database Style

Start with `database/sql` and handwritten SQL.

Good default:

```text
queries live close to db package or product package
small methods like ListTransactions, CreateCategory, GetUserByGoogleID
transactions explicit in code
migrations checked into repo as SQL files
```

Add `sqlc` when:

- query count is high
- type safety would prevent real mistakes
- the schema is stable enough to justify generation
- generated code does not dominate the app

Avoid:

```text
large ORM
generic data mapper
premature repository interfaces for every table
```

### Auth and Sessions

The Ari-compatible Go path is:

```text
golang.org/x/oauth2
Google OAuth endpoint pair
users table keyed by Google account identity
session cookie or server-side session store
middleware loads current user into request context
templates receive current user
```

For sessions:

- `gorilla/sessions` is simple and familiar for cookie or filesystem-backed sessions.
- `alexedwards/scs` is a good choice for server-side sessions and custom stores.
- A small SQLite-backed session store is appropriate if the app wants session durability without another service.

### Migrations

Use SQL migration files.

Good options:

```text
goose
tern
custom _migrations table
startup migration runner for small apps
```

The stack should keep migrations operationally boring. SQL files should be readable and close to the product.

### Testing

Go's standard test tools fit the Ari pattern well:

```text
httptest.NewRecorder
httptest.NewRequest
temporary SQLite database
test server with injected dependencies
fake OAuth/integration clients
table-driven handler tests
```

Handlers should depend on a small `App` or `Server` struct that holds config, database, templates, session store, and service clients. That gives the same testability as an Express `createApp()` factory.

## Python vs Go

| Dimension | Python / Flask | Go / net-http-chi |
| --- | --- | --- |
| Closest to Express/EJS | Strongest | Good, but more explicit |
| Template ergonomics | Excellent with Jinja2 | Good but stricter with html/template |
| Shipping speed | Very fast | Fast after project skeleton exists |
| Deployment | Simple, but runtime/process based | Very simple single binary |
| Type safety | Light by default | Strong |
| SQL style | Very flexible | Explicit and disciplined |
| Integration ecosystem | Excellent for AI/data/product APIs | Strong for infra/network services |
| Framework gravity | Low with Flask | Very low with net/http |
| Best fit | small SaaS, dashboards, internal tools, AI/data-heavy apps | durable services, small products, tools needing easy deployment |

## Recommended Defaults by Product Type

Use **Flask** when:

- speed of product iteration matters most
- templates and forms are central
- AI/data libraries are important
- the app resembles Express/EJS closely
- the team wants minimal ceremony but Python ergonomics

Use **Go** when:

- deployment simplicity matters most
- long-running service reliability matters
- strong typing is valuable
- direct SQL and explicit handlers are preferred
- the app should compile into a small, portable service

Use **FastAPI** when:

- the product is genuinely API-first
- OpenAPI matters
- request/response schemas are central
- async I/O is a major requirement

Use **Django** when:

- admin is central
- CRUD and permissions dominate
- the ORM is a major advantage
- a larger convention-heavy framework is desired

## Likely Ari Defaults

If the next Ari product were Python-based, the default should probably be:

```text
Flask
Jinja2
Blueprints
static/styles.css with design tokens
static/*.js page controllers
SQLite locally
hosted SQLite/Postgres only when deployment needs it
Authlib Google OAuth
server-side sessions
direct SQL or SQLAlchemy Core
pytest route tests once auth/data workflows exist
```

If the next Ari product were Go-based, the default should probably be:

```text
Go
net/http
chi
html/template
static/styles.css with design tokens
static/*.js page controllers
SQLite locally
database/sql
handwritten SQL, sqlc only after query complexity grows
Google OAuth through x/oauth2
server-side or signed-cookie sessions
httptest coverage once auth/data workflows exist
single binary deployment
```

## One-Sentence Definition

The Ari backend stack should be a server-rendered, session-backed, SQLite-first product stack with direct SQL, plain templates, route-level workflow ownership, and carefully chosen domain libraries, optimized for shipping complete useful tools without unnecessary framework or build complexity.
