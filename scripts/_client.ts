/**
 * Shared helpers for the verification scripts: cookie jar, credential login,
 * and JSON request helpers against a running dev server.
 */

export const ok = (m: string) => console.log(`  ✓ ${m}`);
export const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

export class Jar {
  private jar = new Map<string, string>();

  absorb(res: Response) {
    for (const raw of (res.headers as any).getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(fragment: string) {
    return [...this.jar.keys()].some((k) => k.includes(fragment));
  }
}

export function makeClient(base: string) {
  async function login(id: string, password: string) {
    const jar = new Jar();
    const csrfRes = await fetch(`${base}/api/auth/csrf`);
    jar.absorb(csrfRes);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    const res = await fetch(`${base}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: jar.header(),
      },
      body: new URLSearchParams({
        enrollmentNumber: id,
        password,
        csrfToken,
        callbackUrl: `${base}/dashboard`,
      }),
      redirect: "manual",
    });
    jar.absorb(res);
    return jar;
  }

  async function request(
    method: string,
    path: string,
    jar: Jar,
    body?: unknown
  ): Promise<{ status: number; json: any; text: string }> {
    const init: RequestInit = {
      method,
      headers: {
        cookie: jar.header(),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      redirect: "manual",
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, json, text };
  }

  return {
    login,
    get: (path: string, jar: Jar) => request("GET", path, jar),
    post: (path: string, jar: Jar, body?: unknown) => request("POST", path, jar, body),
    patch: (path: string, jar: Jar, body?: unknown) => request("PATCH", path, jar, body),
    del: (path: string, jar: Jar) => request("DELETE", path, jar),
  };
}
