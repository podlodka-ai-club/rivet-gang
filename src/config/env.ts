export type EnvLookup =
  | { status: "found"; name: string; value: string }
  | { status: "missing"; name: string };

export function readEnv(env: NodeJS.ProcessEnv, name: string): EnvLookup {
  const value = env[name];
  if (!value) {
    return { status: "missing", name };
  }

  return { status: "found", name, value };
}
