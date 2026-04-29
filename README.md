# Rivet Gang (`rg`)

`rg` is a local-first CLI agent for working on Linear tasks from this repository.
Each team member runs it on their own machine with local API keys and local runtime state.

## Team Setup

### 1. Install and Build

Use Node.js 22 or newer.

```sh
npm install
npm run build
```

Check that the local executable starts:

```sh
./rg --help
```

If `node` is not on your `PATH`, set `NODE_BIN` when running `./rg`:

```sh
NODE_BIN=/path/to/node ./rg --help
```

### 2. Initialize Local Agent State

Run this once per checkout:

```sh
./rg init
```

This creates `.ai-agent/` with local runtime state and `.ai-agent/config.yaml`.
Do not commit secrets or local `.ai-agent/` runtime files.

### 3. Configure Linear

Create a Linear API key for your own account, then export it:

```sh
export GR_LINEAR_API_KEY=<your-linear-api-key>
```

The generated config should point at that env var:

```yaml
tracker:
  provider: linear
  authEnv: GR_LINEAR_API_KEY
  eligibilityLabel: ai-agent
```

`rg` uses the `ai-agent` label to find eligible Linear tasks.

### 4. Configure LLM Access

For Google AI Studio / Gemini, create an API key at `aistudio.google.com`, then export it:

```sh
export GR_LLM_API_KEY=<your-google-ai-studio-api-key>
```

Set the LLM section in `.ai-agent/config.yaml`:

```yaml
llm:
  provider: gemini
  model: gemini-2.5-flash
  authEnv: GR_LLM_API_KEY
  baseUrl: https://generativelanguage.googleapis.com/v1beta/openai
```

`baseUrl` must be only the OpenAI-compatible API base URL. Do not put a `curl`
command or a `:generateContent` URL there.

### 5. Configure Validation Commands

Validation commands are optional but recommended. `rg doctor` reports missing,
unsafe, or unavailable validation commands as `WARN`, not `FAIL`, because API
and repository readiness should not be blocked by local quality tooling.

```yaml
validation:
  test: npm test
  lint: npm run lint
  typecheck: npm run typecheck
  secretScan: npm run secretScan
```

Current repository scripts include `test`, `lint`, `typecheck`, and
`secretScan`.

If `rg doctor` reports `WARN command test: unavailable executable npm`, the
shell used by `rg` does not have `npm` on `PATH`. Fix that in one of two ways:

- install Node.js/npm so `npm` is available on `PATH`
- set `validation.test` and `validation.typecheck` to the absolute npm CLI path
  for your machine

Example using an absolute npm CLI path:

```yaml
validation:
  test: /path/to/node /path/to/npm-cli.js test
  lint: /path/to/node /path/to/npm-cli.js run lint
  typecheck: /path/to/node /path/to/npm-cli.js run typecheck
  secretScan: /path/to/node /path/to/npm-cli.js run secretScan
```

### 6. Verify Readiness

Run:

```sh
./rg doctor
```

Expected ready-state checks include:

- repository access
- repository instructions
- config validation
- VCS configuration
- Linear authentication
- LLM configuration, authentication, and API access
- local validation command readiness warnings

If a check fails or warns, `rg doctor` prints the env var or config key to fix
without printing secret values. Only `FAIL` checks make the overall result fail.
