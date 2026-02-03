const API_URL = "http://localhost:8000"
// const API_URL = "https://api.gautam-everis-demo.com"

type RequestOptions = {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
    body?: unknown
    headers?: Record<string, string>
}

export class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.status = status
        this.name = "ApiError"
    }
}

export async function api<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const config: RequestInit = {
        method: options?.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    }

    if (options?.body) {
        config.body = JSON.stringify(options.body)
    }

    const res = await fetch(`${API_URL}${endpoint}`, config)

    if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error")
        throw new ApiError(errorText || `HTTP ${res.status}`, res.status)
    }

    return res.json()
}

// Convenience methods
export const get = <T>(endpoint: string) => api<T>(endpoint)

export const post = <T>(endpoint: string, body: unknown) =>
    api<T>(endpoint, { method: "POST", body })

export const put = <T>(endpoint: string, body: unknown) =>
    api<T>(endpoint, { method: "PUT", body })

export const patch = <T>(endpoint: string, body: unknown) =>
    api<T>(endpoint, { method: "PATCH", body })

export const del = <T>(endpoint: string) =>
    api<T>(endpoint, { method: "DELETE" })