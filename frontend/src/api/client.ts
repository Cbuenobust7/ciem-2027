import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

const API_URL =
  import.meta.env.VITE_API_URL || window.location.origin

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

let isRefreshing = false

type FailedRequest = {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let failedQueue: FailedRequest[] = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    }
  })

  failedQueue = []
}

// ============================================================
// REQUEST: añade JWT
// ============================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ============================================================
// RESPONSE: refresh automático
// ============================================================

apiClient.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const refreshToken = localStorage.getItem('refresh_token')

    if (!refreshToken) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      return Promise.reject(error)
    }

    if (originalRequest.url?.includes('/token/refresh/')) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(apiClient(originalRequest))
          },
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      const response = await axios.post<{
        access: string
        refresh?: string
      }>(
        `${API_URL}/api/auth/token/refresh/`,
        {
          refresh: refreshToken,
        },
      )

      const newAccessToken = response.data.access

      localStorage.setItem('access_token', newAccessToken)
      if (response.data.refresh) {
        localStorage.setItem('refresh_token', response.data.refresh)
      }

      processQueue(null, newAccessToken)

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      }

      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)

      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')

      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
