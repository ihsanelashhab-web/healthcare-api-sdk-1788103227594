// Auto-generated SDK for Healthcare API v1.0.0
// Do not edit manually

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export class SDKError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly isRetryable: boolean;

  constructor(message: string, status: number, body: unknown, isRetryable = false) {
    super(message);
    this.name = "SDKError";
    this.status = status;
    this.body = body;
    this.isRetryable = isRetryable;
  }
}

export class Client {
  private baseUrl: string;
  private apiKey: string | null;
  private bearerToken: string | null;
  private customHeaders: Record<string, string>;
  private requestInterceptor?: RequestInterceptor;
  private responseInterceptor?: ResponseInterceptor;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    bearerToken?: string;
    /** هيدرز ثابتة تتضاف لكل request (زي X-Tenant-Id, X-Client-Version, إلخ) */
    headers?: Record<string, string>;
    /** بتتنفذ قبل كل request، بتقدر تعدّل الـ url/method/headers/body (مفيدة لتوكنات بتتجدد، custom signing، logging) */
    requestInterceptor?: RequestInterceptor;
    /** بتتنفذ بعد كل response وقبل فحص res.ok (مفيدة لمعالجة أخطاء موحدة أو logging) */
    responseInterceptor?: ResponseInterceptor;
  }) {
    this.baseUrl = options?.baseUrl ?? "https://api.hospital.com/v1";
    this.apiKey = options?.apiKey ?? null;
    this.bearerToken = options?.bearerToken ?? null;
    this.customHeaders = options?.headers ?? {};
    this.requestInterceptor = options?.requestInterceptor;
    this.responseInterceptor = options?.responseInterceptor;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async parseErrorBody(res: Response): Promise<unknown> {
    try { return await res.json(); } catch { return undefined; }
  }

  /** Exponential backoff + full jitter: base 500ms, doubles per attempt, capped at 8s, honors Retry-After when given. */
  private backoffDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined && retryAfterMs >= 0) return retryAfterMs;
    const base = 500;
    const cap = 8000;
    const exp = Math.min(cap, base * Math.pow(2, attempt - 1));
    return Math.random() * exp;
  }

  private parseRetryAfter(res: Response): number | undefined {
    const header = res.headers?.get?.("Retry-After");
    if (!header) return undefined;
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds * 1000;
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    return undefined;
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>, params?: Record<string, string>, retries = 3, timeoutMs = 30000): Promise<T> {
    let url = this.baseUrl + path;
    if (params) {
      const query = new URLSearchParams(params).toString();
      if (query) url += "?" + query;
    }
    let headers: Record<string, string> = { "Content-Type": "application/json", ...this.customHeaders };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    if (this.bearerToken) headers["Authorization"] = "Bearer " + this.bearerToken;
    let requestBody = body ? JSON.stringify(body) : undefined;

    if (this.requestInterceptor) {
      const config = await this.requestInterceptor({ url, method, headers, body: requestBody });
      url = config.url;
      method = config.method;
      headers = config.headers;
      requestBody = config.body;
    }

    const isIdempotent = method === "GET";

    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let res = await fetch(url, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (this.responseInterceptor) {
          res = await this.responseInterceptor(res);
        }

        if (!res.ok) {
          const isRetryableStatus = res.status === 429 || res.status >= 500;
          const errorBody = await this.parseErrorBody(res);
          if (isIdempotent && isRetryableStatus && attempt < retries) {
            const retryAfterMs = res.status === 429 ? this.parseRetryAfter(res) : undefined;
            await this.sleep(this.backoffDelay(attempt, retryAfterMs));
            continue;
          }
          throw new SDKError(`API Error ${res.status}: ${res.statusText}`, res.status, errorBody, isRetryableStatus);
        }

        if (res.status === 204) return undefined as unknown as T;
        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof SDKError) throw err;
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (isIdempotent && attempt < retries) {
          await this.sleep(this.backoffDelay(attempt));
          continue;
        }
        if (isAbort) throw new SDKError("Request timed out", 0, undefined, false);
        throw err;
      }
    }
    throw new SDKError("Request failed after " + retries + " retries", 0, undefined, false);
  }

  /**
   * Get all patients
   */
  async getPatients(): Promise<unknown> {
    return this.request<unknown>("GET", `/patients`);
  }

  /**
   * Register new patient
   */
  async registerPatient(): Promise<unknown> {
    return this.request<unknown>("POST", `/patients`);
  }

  /**
   * Get patient medical records
   */
  async getMedicalRecords(id: string): Promise<unknown> {
    return this.request<unknown>("GET", `/patients/${id}/records`);
  }

  /**
   * List appointments
   */
  async getAppointments(): Promise<unknown> {
    return this.request<unknown>("GET", `/appointments`);
  }

  /**
   * Book appointment
   */
  async bookAppointment(): Promise<unknown> {
    return this.request<unknown>("POST", `/appointments`);
  }

  /**
   * Get all doctors
   */
  async getDoctors(params?: Record<string, string>): Promise<unknown> {
    return this.request<unknown>("GET", `/doctors`, undefined, params);
  }

}

/** Fetch all pages automatically */
export async function paginate<T>(fn: (page: number) => Promise<T[]>, maxPages = 10): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fn(page);
    if (!data || data.length === 0) break;
    results.push(...data);
  }
  return results;
}

/**
 * MockClient — نفس واجهة Client بالضبط، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.
 * مفيد لتطوير الفرونت إند قبل جاهزية الـ backend، أو لكتابة اختبارات بدون سيرفر حقيقي.
 * الاستخدام: const client = new MockClient(); // نفس استدعاءات Client تمامًا
 */
export class MockClient {
  private latencyMs: number;

  constructor(options?: { latencyMs?: number }) {
    this.latencyMs = options?.latencyMs ?? 200;
  }

  /** Get all patients (mock) */
  async getPatients(): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

  /** Register new patient (mock) */
  async registerPatient(): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

  /** Get patient medical records (mock) */
  async getMedicalRecords(_id: string): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

  /** List appointments (mock) */
  async getAppointments(): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

  /** Book appointment (mock) */
  async bookAppointment(): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

  /** Get all doctors (mock) */
  async getDoctors(_params?: Record<string, string>): Promise<unknown> {
    await new Promise(r => setTimeout(r, this.latencyMs));
    return undefined as unknown as unknown;
  }

}
