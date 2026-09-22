import { z } from "zod";

import type { AuthPort } from "./platform";

export const ApiProblemSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ApiProblem = z.infer<typeof ApiProblemSchema>;

export class ApiTransportError extends Error {
  readonly status: number | undefined;
  readonly problem: ApiProblem | undefined;

  constructor(
    message: string,
    options: { status?: number; problem?: ApiProblem } = {},
  ) {
    super(message);
    this.name = "ApiTransportError";
    this.status = options.status;
    this.problem = options.problem;
  }
}

export interface ApiRequest<T> {
  readonly path: `/${string}`;
  readonly response: z.ZodType<T>;
  readonly init?: RequestInit;
}

export interface ApiTransport {
  request<T>(request: ApiRequest<T>): Promise<T>;
}

export interface CreateApiTransportOptions {
  readonly origin: string;
  readonly auth: AuthPort;
  readonly fetch?: typeof fetch;
}

function apiUrl(origin: string, path: string): URL {
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/v1/")) {
    throw new ApiTransportError("Invalid API request path");
  }
  return url;
}

async function readProblem(
  response: Response,
): Promise<ApiProblem | undefined> {
  try {
    return ApiProblemSchema.safeParse(await response.json()).data;
  } catch {
    return undefined;
  }
}

export function createApiTransport({
  origin,
  auth,
  fetch: fetcher = fetch,
}: CreateApiTransportOptions): ApiTransport {
  const normalizedOrigin = new URL(origin).origin;

  return {
    async request<T>({ path, response, init }: ApiRequest<T>): Promise<T> {
      const token = await auth.getAccessToken();
      const headers = new Headers(init?.headers);
      headers.set("Accept", "application/json");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const url = apiUrl(normalizedOrigin, path);
      let result: Response;
      try {
        result = await fetcher(url, { ...init, headers });
      } catch {
        throw new ApiTransportError("API network request failed");
      }

      if (!result.ok) {
        const problem = await readProblem(result);
        throw new ApiTransportError(
          problem?.message ?? `API request failed (${result.status})`,
          {
            status: result.status,
            ...(problem ? { problem } : {}),
          },
        );
      }

      let body: unknown;
      try {
        body = await result.json();
      } catch {
        throw new ApiTransportError("API returned an invalid JSON response", {
          status: result.status,
        });
      }

      const parsed = response.safeParse(body);
      if (!parsed.success) {
        throw new ApiTransportError("API returned an invalid response", {
          status: result.status,
        });
      }
      return parsed.data;
    },
  };
}
