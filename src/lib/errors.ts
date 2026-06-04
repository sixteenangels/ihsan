export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export async function getSupabaseFunctionErrorMessage(error: unknown, fallback = "Something went wrong") {
  const maybeContext = (error as { context?: unknown } | null | undefined)?.context;
  if (maybeContext instanceof Response) {
    try {
      const body = await maybeContext.clone().json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        return body.error;
      }
      if (body && typeof body.message === "string" && body.message.trim()) {
        return body.message;
      }
    } catch {
      // Fall through to the generic message helper.
    }
  }

  return getErrorMessage(error, fallback);
}
