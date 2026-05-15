/** FastAPI `detail`(문자열·배열·객체 등)에서 사용자 표시용 문자열 추출 */

function extractFastApiDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) return null;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const m = (item as { msg?: unknown }).msg;
          return typeof m === "string" ? m : String(m ?? "");
        }
        return "";
      })
      .filter((s) => s.length > 0);
    return msgs.length ? msgs.join("; ") : null;
  }

  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.msg === "string") return o.msg;
    if (typeof o.error === "string") {
      const parts = [o.error];
      if (typeof o.required === "number") parts.push(`필요 ${o.required}`);
      if (typeof o.balance === "number") parts.push(`보유 ${o.balance}`);
      return parts.join(" · ");
    }
    const firstStr = Object.values(o).find((v) => typeof v === "string" && v.trim().length > 0);
    if (typeof firstStr === "string") return firstStr;
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }

  return String(detail);
}

/**
 * HTTP 오류 응답 본문(text)과 상태 코드로 사용자에게 보여줄 메시지 생성.
 * JSON이 아니거나 빈 본문이면 상태 코드 중심 메시지를 반환합니다.
 */
export function formatApiErrorMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  let parsed: unknown = null;
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const fromDetail = extractFastApiDetail(obj.detail);
    if (fromDetail) return fromDetail;
    if (typeof obj.message === "string") return obj.message;
  }

  if (trimmed && !trimmed.startsWith("<") && trimmed.length <= 500) {
    return trimmed;
  }

  return `요청 실패 (${status})`;
}
