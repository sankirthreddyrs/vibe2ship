const originalFetch = window.fetch;

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as any).url || "";
    if (url.includes("/api/") && !url.includes("/api/gemini-status") && !url.includes("/api/health")) {
      if (response.headers.get("x-gemini-fallback") === "true") {
        window.dispatchEvent(new CustomEvent("gemini-api-failed"));
      }
    }
    return response;
  } catch (err) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as any).url || "";
    if (url.includes("/api/") && !url.includes("/api/gemini-status") && !url.includes("/api/health")) {
      window.dispatchEvent(new CustomEvent("gemini-api-failed"));
    }
    throw err;
  }
};
