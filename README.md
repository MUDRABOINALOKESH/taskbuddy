# TaskBuddy

A responsive task manager with private accounts, task CRUD, categories, priorities, due dates, search, filters, and completion progress.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev:api
```

In a second terminal, from the project directory:

```sh
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`) and create an account. The API stores account and task data in `data/store.json`; passwords are hashed with Node's scrypt implementation. Keep that file private and out of version control.

For a production frontend bundle, run `npm run build`. Deploy the static `dist` directory and Node API separately, then set `VITE_API_URL` to the deployed API's `/api` base URL when building. Set `APP_ORIGIN` on the API to the frontend origin if they are on different domains.

## API

- `POST /api/auth/register` and `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

Authenticated task requests use `Authorization: Bearer <token>`. Each task is scoped to its owner.

## Tutorial

Project tutorial: [AI Breakthroughs: Innovations on the Horizon](https://www.youtube.com/watch?v=Q4aB0IgKYx0)

## Submission

This workspace initially had no Git repository or remote. The project is now committed locally; add a Git hosting remote and push the `main` branch to get a URL to submit. Do not commit `data/store.json`, which contains local account data.