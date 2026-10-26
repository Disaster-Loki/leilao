const API = import.meta.env.VITE_API_URL as string;

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw (data?.error ? data : { error: "INTERNAL_ERROR" }) as ApiError;
  return data as T;
}
