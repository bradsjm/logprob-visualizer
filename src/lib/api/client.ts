const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${detail ? ` - ${detail}` : ""}`,
    );
  }
  return (await response.json()) as T;
}

export { API_BASE, parseJsonResponse };
