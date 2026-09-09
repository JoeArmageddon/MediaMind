import { callWebApi } from '../webApi';

// Clerk doesn't allow client-side code to resolve other users by email or
// look up a user profile by id (privacy) - those lookups need the Clerk
// secret key, server-side. The web app already has that server side
// (src/app/api/friends/find, src/app/api/friends/profiles) and is
// deployed, so these hit the same deployed routes over HTTPS via
// ../webApi's callWebApi (shared with the AI/search proxies in
// lib/ai/*.ts and lib/api/{tmdb,rawg}.ts - same bearer-token pattern, same
// reason: nothing that needs a real secret gets bundled into this app).

export interface FoundUser {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

export async function findUserByEmail(email: string): Promise<FoundUser> {
  return callWebApi<FoundUser>('/api/friends/find', { email });
}

export async function resolveProfiles(
  userIds: string[]
): Promise<Record<string, FoundUser>> {
  if (userIds.length === 0) return {};
  const { profiles } = await callWebApi<{ profiles: Record<string, FoundUser> }>(
    '/api/friends/profiles',
    { userIds }
  );
  return profiles;
}

export interface InvitePreview {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

// Resolves a friend or collection invite code to the owner's public
// profile, before actually redeeming it - same route both invite flows
// use on web (see friendStore.ts/collectionStore.ts's previewInviteCode).
export async function previewInviteCode(code: string): Promise<InvitePreview> {
  return callWebApi<InvitePreview>('/api/friends/preview-code', { code });
}
