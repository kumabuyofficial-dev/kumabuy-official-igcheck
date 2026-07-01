import type { Config, Context } from "@netlify/functions";

const redirectUri =
  Netlify.env.get("META_INSTAGRAM_REDIRECT_URI") ||
  "https://kumabuy-official-igcheck.netlify.app/.netlify/functions/instagram-callback";

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const appId = Netlify.env.get("META_INSTAGRAM_APP_ID");
  if (!appId) {
    return json({ error: "Missing META_INSTAGRAM_APP_ID" }, 500);
  }

  const state = crypto.randomUUID();
  context.cookies.set({
    name: "ig_oauth_state",
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL("https://api.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic");
  url.searchParams.set("state", state);
  url.searchParams.set("force_reauth", "true");

  return Response.redirect(url.toString(), 302);
};

export const config: Config = {
  path: "/api/instagram/start",
  method: ["GET"],
};
