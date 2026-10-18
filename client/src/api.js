let token = sessionStorage.getItem("foundit.token");
export const session = {
  set(t, r) {
    token = t;
    sessionStorage.setItem("foundit.token", t);
    if (r) sessionStorage.setItem("foundit.refresh", r);
  },
  clear() {
    token = null;
    sessionStorage.removeItem("foundit.token");
    sessionStorage.removeItem("foundit.refresh");
  },
  has: () => Boolean(token),
};
let renewing;
export async function api(path, options = {}, retry = true) {
  const res = await fetch("/api/v1" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (
    res.status === 401 &&
    retry &&
    sessionStorage.getItem("foundit.refresh") &&
    !path.startsWith("/auth/")
  ) {
    renewing ||= api(
      "/auth/refresh",
      {
        method: "POST",
        body: { refreshToken: sessionStorage.getItem("foundit.refresh") },
      },
      false,
    )
      .then((d) => session.set(d.token))
      .finally(() => {
        renewing = null;
      });
    try {
      await renewing;
      return api(path, options, false);
    } catch {
      session.clear();
      window.dispatchEvent(new Event("foundit:signedout"));
    }
  }
  const data = await res
    .json()
    .catch(() => ({ error: "Could not reach FoundIt. Please try again." }));
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Request failed."), {
      status: res.status,
    });
  return data;
}
