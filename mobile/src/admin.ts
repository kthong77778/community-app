// Client-side admin identification for showing/hiding moderation UI only.
// The server is the real authority on permissions — this just gates which
// controls appear in the app.
export const ADMIN_USERNAMES = ["admin", "댕냥마을지기"];

export function isAdmin(username?: string | null): boolean {
  return !!username && ADMIN_USERNAMES.includes(username);
}
