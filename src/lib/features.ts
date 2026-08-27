// Feature flags. Flip these to turn a whole feature's UI on/off without
// deleting its code — the backend/store stays in place so it can be re-enabled.
//
// 채팅(1:1 메시지)은 서버 상시 운영 부담 때문에 지금은 꺼둔다. 코드는 그대로
// 보관돼 있고, 이 값을 true로 바꾸거나 NEXT_PUBLIC_CHAT_ENABLED=true 환경변수를
// 주면 진입점(헤더 링크·상품상세 채팅하기 등)이 다시 나타난다.
export const CHAT_ENABLED = process.env.NEXT_PUBLIC_CHAT_ENABLED === "true";
