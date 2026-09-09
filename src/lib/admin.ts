// This app has exactly one admin (Kshitij) and no role system anywhere
// else in the schema - "is this the admin" is checked by comparing the
// signed-in user's email against this constant, server-side, everywhere
// it matters (the beta-application review API routes, middleware's beta-
// approval gate). Not configurable via env var on purpose: it's a single
// hardcoded value specifically so it can't be silently misconfigured by
// an empty/missing env var granting admin to nobody - or everybody.
export const ADMIN_EMAIL = 'takiar.kshitij@gmail.com';
