"use client";

// ---------------------------------------------------------------------------
// Global SWR Configuration
// ---------------------------------------------------------------------------

export const swrFetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("未登录");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `请求失败 (${res.status})`);
  }
  return res.json();
};

export const swrConfig = {
  fetcher: swrFetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  errorRetryCount: 2,
};
