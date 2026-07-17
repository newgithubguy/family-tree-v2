# Collaborative Family Tree (Next.js + Relational Mock DB)

A multi-user family tree prototype with:
- Next.js App Router + Tailwind CSS + Lucide icons
- Local relational mock database persisted as JSON tables for people, unions, and union-child links
- Multi-user tree membership (`viewer` / `editor`)
- Login-based multi-user access with admin console
- Automatic audit log for all CREATE/UPDATE/DELETE operations

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Login Users

- `alex@example.com` / `admin123` (owner + editor)
- `sam@example.com` / `editor123` (editor)
- `jo@example.com` / `viewer123` (viewer)

## Admin Console

The tree owner can:
- Create new users
- Add existing users to the tree
- Change member roles (`viewer` / `editor`)
- Remove non-owner members

## Run With Docker

Build and run:

```bash
docker compose up --build
```

App endpoints:
- `http://localhost:3000` (web app)
- `ws://localhost:3001/ws` (realtime socket)

The mock relational data persists in the Docker named volume `family-tree-v2-data`.

## Data Model

- `people`: individual persons
- `unions`: partnership nodes connecting two specific partners
- `union_children`: child mapped to one specific union
- `tree_members`: membership and role per tree
- `activity_log`: change history with old/new JSON payloads

This structure allows one parent to have multiple distinct unions while preserving accurate child-to-partnership mapping.
