# Ozai API Studio

Desktop API client built with Electron, React, and TypeScript. Collections, requests, environments, saved response examples, and the hosted Supabase mock API live in this repository.

The hosted mock API is an Edge Function under `supabase/functions/mock`. See [`supabase/README.md`](supabase/README.md) for matching rules, deployment, and security details.

## Supabase Mock API — curl examples

The mock base URL and publishable key are **not** committed. They live in the local `secret.txt` file, which is ignored by Git.

```bash
cp secret.example.txt secret.txt
# edit secret.txt and fill in the real values
source secret.txt

BASE="$MOCK_API_BASE_URL"
KEY="$SUPABASE_PUBLISHABLE_KEY"
```

`secret.txt` is gitignored. Never commit it.

### 1. Health check

```bash
curl -sS \
  -H "apikey: $KEY" \
  "$BASE/__ozai/health"
```

### 2. List all routes and examples

```bash
curl -sS \
  -H "apikey: $KEY" \
  "$BASE/__ozai/routes"
```

### 3. Login — default example (200)

```bash
curl -sS -X POST \
  -H "apikey: $KEY" \
  -H "content-type: application/json" \
  -d '{"username":"imam","password":"Admin123!"}' \
  "$BASE/api/v1/auth/login"
```

### 4. Login — force the 400 example

```bash
curl -sS -X POST \
  -H "apikey: $KEY" \
  -H "content-type: application/json" \
  -d '{}' \
  "$BASE/api/v1/auth/login?__example=400"
```

Or select the example with a header:

```bash
curl -sS -X POST \
  -H "apikey: $KEY" \
  -H "x-ozai-example: 400" \
  -H "content-type: application/json" \
  -d '{}' \
  "$BASE/api/v1/auth/login"
```

### 5. Path parameter

An example saved at `/api/v1/audit-trails/1` also matches any numeric or UUID segment at that position.

```bash
curl -sS \
  -H "apikey: $KEY" \
  "$BASE/api/v1/audit-trails/123"
```

### 6. Pin a saved commit

```bash
curl -sS \
  -H "apikey: $KEY" \
  "$BASE/__ozai/health?__commit=1"
```

### 7. Unknown route (404)

```bash
curl -sS \
  -H "apikey: $KEY" \
  "$BASE/api/v1/does-not-exist"
```

### 8. CORS preflight

```bash
curl -sS -i -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: apikey,content-type" \
  "$BASE/api/v1/auth/login"
```

### 9. Missing key (401)

```bash
curl -sS "$BASE/__ozai/health"
```

## FE configuration

Set the mock API base URL in the frontend environment and send the publishable key as the `apikey` header on every request:

```http
apikey: <publishable-key>
```

Select a specific example with `?__example=400` or `x-ozai-example: 400`. The default is the newest `2xx` example.
