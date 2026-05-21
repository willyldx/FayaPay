import type { ApiError } from '@/lib/types'

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fayapay.app'

// =============================================================================
// Erreur API typée
// =============================================================================

export class FayaApiError extends Error {
  public readonly status: number
  public readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'FayaApiError'
    this.status = status
    this.code = code
  }
}

// =============================================================================
// Client HTTP central
// =============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  /** Headers supplémentaires */
  headers?: Record<string, string>
  /** Paramètres de query string */
  params?: Record<string, string | number | boolean | undefined>
  /** Signal pour annulation */
  signal?: AbortSignal
}

/**
 * Construit l'URL complète avec les query params.
 */
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`/v1${path}`, API_BASE_URL)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  return url.toString()
}

/**
 * Exécute une requête HTTP vers l'API FayaPay.
 *
 * - Le JWT est envoyé automatiquement via le cookie httpOnly
 *   (credentials: 'include' force l'envoi des cookies)
 * - Les erreurs HTTP sont transformées en FayaApiError
 * - Un 401 déclenche une redirection vers /login
 */
async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const url = buildUrl(path, options.params)

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...options.headers,
  }

  // Ajouter Content-Type uniquement si on envoie un body
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include', // Envoie automatiquement le cookie JWT httpOnly
    signal: options.signal,
  })

  // --- Gestion des erreurs HTTP ---

  if (!response.ok) {
    // 401 → session expirée ou invalide → redirect login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new FayaApiError('Session expirée', 401, 'UNAUTHORIZED')
    }

    // Tenter de parser le body d'erreur de l'API
    let apiError: ApiError | null = null
    try {
      apiError = (await response.json()) as ApiError
    } catch {
      // Le body n'est pas du JSON — on utilise le statusText
    }

    throw new FayaApiError(
      apiError?.error ?? `Erreur HTTP ${response.status}`,
      response.status,
      apiError?.code ?? `HTTP_${response.status}`
    )
  }

  // 204 No Content → pas de body à parser
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

// =============================================================================
// Méthodes publiques typées
// =============================================================================

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options)
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options)
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options)
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, options)
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options)
  },
} as const
