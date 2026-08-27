// Admin (운영자) 판별. 계정이 하드코딩(accounts.json)이므로 관리자도 사용자명으로
// 지정한다. 비밀이 아니므로 클라이언트에서 import해 관리 UI 노출 여부를 정해도 되지만,
// 실제 권한 검사는 반드시 서버(API 라우트)에서 한다.
export const ADMIN_USERNAMES = ["admin", "댕냥마을지기"];

export function isAdmin(username?: string | null): boolean {
  return !!username && ADMIN_USERNAMES.includes(username);
}
