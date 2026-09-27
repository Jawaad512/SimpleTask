# SimpleTask

A personal task app built around one idea: sort tasks on a 2x2 grid instead of a list.

On the grid, one axis represents task duration, and the other is whether it's happening today. You move a task by simply dragging it. Deadlines sit in their own pane, scheduled habits spawn themselves onto the board on the days you set, and there is also a list view with filtering options.

The app runs as an installable PWA and works offline.

Anyone can try it without an account. A "Guest demo" option loads a seeded board that lives in the browser and never touches the real database.

Feel free to express your interest and leave your feedback in the guest demo mode!

## Stack

- **React 19 + Vite + TypeScript**
- **Tailwind CSS v4** for styling
- **@dnd-kit** for drag-and-drop
- **Supabase** (Postgres, auth, row-level security) as the backend, with no separate API layer
- **TanStack Query** for data fetching and optimistic updates
- **vite-plugin-pwa** for offline support and installability

Deployed on Vercel at [simpletask-jawaad.vercel.app](https://simpletask-jawaad.vercel.app).
