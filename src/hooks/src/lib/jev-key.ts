// Shared key lookup for the TypeScript Jev seams. Never logs or persists values.
export const TYPESAFE_KEY_ENV = 'ORK_TYPESAFE_API_KEY';

export function resolveTypesafeKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = (env[TYPESAFE_KEY_ENV] || '').trim();
  return key || null;
}
