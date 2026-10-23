# Ozai Mock API (Supabase Edge Function)

Hosted mock endpoint for the examples saved in Ozai API Studio. The desktop app keeps authoring the workspace locally; uploads go to Supabase. The Edge Function reads the latest `studio_workspace` snapshot and serves saved examples as real HTTP responses.

```text
Desktop app (save examples + Upload)
        ↓
Supabase Postgres  studio_workspace.data
        ↓
Edge Function      /functions/v1/mock/*
        ↓
FE / web app
```

## Deploy

```bash
npx supabase functions deploy mock --project-ref <project-ref> --no-verify-jwt
npx supabase secrets set MOCK_KEY=<optional-key> --project-ref <project-ref>
```

`verify_jwt` is disabled because the function does its own key check. If `MOCK_KEY` is set, that key is required; otherwise the function accepts the project's anon/publishable key (`apikey` header, `x-ozai-mock-key`, `Authorization: Bearer`, or `?__mock_key=`).

The repository includes `supabase/config.toml` with the function and project settings.

## FE usage

Base URL:

```text
https://<project-ref>.supabase.co/functions/v1/mock
```

Every request must include the mock key:

```http
apikey: <publishable-or-anon-key>
```

or, if `MOCK_KEY` is configured:

```http
x-ozai-mock-key: <mock-key>
```

Example:

```bash
curl -H "apikey: $SUPABASE_ANON_KEY" \
  "https://<project-ref>.supabase.co/functions/v1/mock/api/v1/auth/login"
```

Point the FE's API base URL at the function and append the normal API paths, e.g.:

```text
https://<project-ref>.supabase.co/functions/v1/mock/api/v1/users/1
```

## Selecting an example

A request can have multiple examples (status 200, 400, 403, …).

- Default: newest `2xx` example; otherwise newest example.
- Select by status:
  ```http
  X-Ozai-Example: 403
  ```
  or
  ```
  ?__example=403
  ```
- Select by name:
  ```http
  X-Ozai-Example: Forbidden case
  ```
- `?__status=403` / `X-Ozai-Status: 403` is also supported.

## Discovery

```text
GET /__ozai/health
GET /__ozai/routes
```

`/__ozai/routes` lists the matched method/path and every available example with its status.

Path parameters: numeric and UUID segments are normalized to `:param` automatically, so an example saved at `/users/1` also matches `/users/123`.

## Data source

The function reads:

- `studio_workspace` row `id = 'default'` (latest snapshot)
- optional `?__commit=<id>` from `studio_commits` to pin a saved commit

If no workspace has been uploaded yet, the endpoint returns `503` with a hint to upload from the desktop app.

## Security

- RLS is enabled on `studio_workspace` and `studio_commits`; no public policies are created. The desktop app uses the Postgres role and the Edge Function uses the service role.
- Prefer a dedicated `MOCK_KEY` for shared/team endpoints.
- Examples can contain real tokens or customer data. Sanitize them before uploading to a shared project.
- `SUPABASE_SERVICE_ROLE_KEY` is only read inside the Edge Function and is never returned to clients.

## Limitations

This is a static mock. It does not emulate stateful flows, pagination, authentication, or database behavior. It returns the saved example response for the matched method/path.
