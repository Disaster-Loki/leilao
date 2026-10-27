const API = import.meta.env.API_URL as string | undefined;

export interface ApiError {
  error: string;
  details?: Record<string, unknown> | unknown[];
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API) throw { error: "API_NOT_CONFIGURED" } as ApiError;

  const token = localStorage.getItem("token");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw { error: "NETWORK_ERROR" } as ApiError;
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw { error: "INVALID_RESPONSE" } as ApiError;
    }
  }

  if (!res.ok) {
    if (data && typeof data === "object" && "error" in data) {
      throw data as ApiError;
    }
    throw { error: "INTERNAL_ERROR" } as ApiError;
  }

  return data as T;
}
