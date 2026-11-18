export type AuthUser = { sub: string; email: string; groups: string[] };

/** Role in the shared Only Tools pool that opens FoodLog (every new account gets it). */
export const ACCESS_GROUP = 'foodlog-user';
export const ADMIN_GROUP = 'foodlog-admin';

/** API Gateway passes array claims as the string "[a b c]". */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String);
  if (typeof claim !== 'string' || !claim) return [];
  return claim
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

type JwtEvent = {
  requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } };
};

/** Reads the claims the API Gateway JWT authorizer verified. Nothing else is trusted for identity. */
export function claimsFrom(event: unknown): AuthUser | null {
  const claims = (event as JwtEvent | undefined)?.requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || !sub) return null;
  return {
    sub,
    email: typeof claims?.email === 'string' ? claims.email : '',
    groups: parseGroups(claims?.['cognito:groups']),
  };
}
