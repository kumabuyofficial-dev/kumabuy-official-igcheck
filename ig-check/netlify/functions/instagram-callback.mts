import type { Config, Context } from "@netlify/functions";

const siteUrl = "https://kumabuy-official-igcheck.netlify.app/";
const redirectUri =
  Netlify.env.get("META_INSTAGRAM_REDIRECT_URI") ||
  "https://kumabuy-official-igcheck.netlify.app/.netlify/functions/instagram-callback";
const graphBase = "https://graph.instagram.com/v24.0";

type TokenResponse = {
  access_token?: string;
  user_id?: string;
};

type Profile = {
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

type MediaItem = {
  id?: string;
  media_type?: string;
  media_product_type?: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root{color-scheme:dark;--teal:#00b7a8;--ink:#f6fafc;--muted:#a9b6c4;--panel:rgba(8,12,18,.86);--line:rgba(246,250,252,.16);--coral:#f05b4f}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 8%,rgba(0,183,168,.22),transparent 28rem),linear-gradient(180deg,#05070a,#0b1118 52%,#05070a);color:var(--ink);font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif}
      main{width:min(980px,calc(100% - 28px));margin:0 auto;padding:32px 0 56px}
      .card{border:1px solid var(--line);border-radius:28px;background:var(--panel);padding:clamp(22px,5vw,38px);box-shadow:0 34px 110px rgba(0,0,0,.46);backdrop-filter:blur(18px)}
      .eyebrow{margin:0 0 8px;color:var(--teal);font-size:.78rem;font-weight:900;letter-spacing:.08em}
      h1{margin:0 0 14px;font-size:clamp(2rem,7vw,4.2rem);line-height:1.05}
      h2{margin:0 0 10px;font-size:clamp(1.4rem,4vw,2.2rem)}
      h3{margin:0 0 8px;font-size:1.15rem}
      p{margin:0;color:#d8e8eb;line-height:1.8}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0}
      .stat,.panel{border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.06);padding:16px}
      .stat small{display:block;margin-bottom:7px;color:var(--muted);font-weight:800}
      .stat b{font-size:1.7rem;color:#fff}
      .result{display:grid;gap:14px;margin-top:18px}
      .pill{display:inline-flex;width:max-content;border:1px solid rgba(0,183,168,.35);border-radius:999px;background:rgba(0,183,168,.12);padding:8px 12px;color:#dffdfa;font-weight:900}
      .panels{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
      ul{margin:8px 0 0;padding-left:20px;color:#d8e8eb;line-height:1.8}
      a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;background:var(--teal);color:#03100f;padding:0 20px;font-weight:900;text-decoration:none}
      .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
      .secondary{background:rgba(255,255,255,.12);color:#fff}
      .warn{border-color:rgba(240,91,79,.35);background:rgba(240,91,79,.1)}
      code{color:var(--teal);word-break:break-all}
      @media (max-width:760px){.grid,.panels{grid-template-columns:1fr}.card{border-radius:22px}}
    </style>
  </head>
  <body><main><section class="card">${body}</section></main></body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

async function exchangeCode(code: string) {
  const appId = Netlify.env.get("META_INSTAGRAM_APP_ID");
  const appSecret = Netlify.env.get("META_INSTAGRAM_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("missing_env");
  }

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TokenResponse;
}

async function graphGet<T>(path: string, accessToken: string) {
  const url = new URL(`${graphBase}${path}`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data as T;
}

async function getProfile(accessToken: string) {
  const fields = [
    "id",
    "username",
    "name",
    "account_type",
    "profile_picture_url",
    "followers_count",
    "follows_count",
    "media_count",
  ].join(",");
  return graphGet<Profile>(`/me?fields=${fields}`, accessToken);
}

async function getRecentMedia(accessToken: string) {
  const fields = ["id", "media_type", "media_product_type", "caption", "timestamp", "permalink", "like_count", "comments_count"].join(",");
  const data = await graphGet<{ data?: MediaItem[] }>(`/me/media?fields=${fields}&limit=12`, accessToken);
  return data.data || [];
}

function daysSince(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function diagnose(profile: Profile, media: MediaItem[]) {
  const mediaCount = Number(profile.media_count || media.length || 0);
  const followers = Number(profile.followers_count || 0);
  const follows = Number(profile.follows_count || 0);
  const reelsCount = media.filter((item) => item.media_product_type === "REELS" || item.media_type === "VIDEO").length;
  const latestDays = daysSince(media[0]?.timestamp);
  const avgCaptionLength = media.length
    ? Math.round(media.reduce((sum, item) => sum + (item.caption || "").length, 0) / media.length)
    : 0;

  const scores = {
    content: 0,
    positioning: 0,
    conversion: 0,
  };
  const reasons: string[] = [];

  if (mediaCount < 18) {
    scores.content += 3;
    reasons.push("貼文累積量偏少，內容樣本還不夠讓陌生人快速建立信任。");
  }
  if (latestDays !== null && latestDays > 14) {
    scores.content += 3;
    reasons.push(`最新內容距今約 ${latestDays} 天，更新節奏可能讓帳號熱度下降。`);
  }
  if (media.length && reelsCount / media.length < 0.35) {
    scores.content += 2;
    reasons.push("近期 Reels 比例偏低，演算法擴散的素材量可以再增加。");
  }
  if (!profile.name || profile.name.length < 2) {
    scores.positioning += 2;
    reasons.push("顯示名稱較不明確，使用者可能不容易立刻理解帳號主題。");
  }
  if (avgCaptionLength < 35 && media.length >= 3) {
    scores.positioning += 2;
    reasons.push("近期文案偏短，主張、受眾與差異點可以說得更清楚。");
  }
  if (followers > 0 && follows / followers > 2) {
    scores.positioning += 2;
    reasons.push("追蹤中數量相對偏高，帳號專業感與定位聚焦度可能被稀釋。");
  }
  const latestCaption = media[0]?.caption || "";
  if (!/(私訊|預約|報名|領取|購買|連結|line|dm|諮詢|了解)/i.test(latestCaption)) {
    scores.conversion += 3;
    reasons.push("最新內容沒有明確行動引導，流量看完後可能不知道下一步。");
  }
  if (followers < 100 && mediaCount >= 10) {
    scores.conversion += 2;
    reasons.push("已有內容累積，但追蹤轉換仍偏早期，需要強化首頁承接與 CTA。");
  }

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "content";
  const labels: Record<string, string> = {
    content: "內容吸引力",
    positioning: "帳號定位",
    conversion: "流量轉換",
  };
  const summaries: Record<string, string> = {
    content: "目前最需要先補強的是內容量、更新節奏與 Reels 擴散素材，讓帳號更容易被看見並被記住。",
    positioning: "目前最需要先補強的是帳號主題、受眾與差異點，讓新訪客一進來就知道你是誰、適合誰。",
    conversion: "目前最需要先補強的是行動引導與承接路徑，讓看過內容的人知道下一步該私訊、點連結或預約。",
  };

  return {
    label: labels[winner],
    summary: summaries[winner],
    reasons: reasons.length ? reasons : ["目前公開基本資料可讀取成功，建議下一步補開洞察權限後再讀取觀看數、觸及與互動數。"],
    reelsCount,
    latestDays,
    avgCaptionLength,
  };
}

function renderReport(profile: Profile, media: MediaItem[]) {
  const diagnosis = diagnose(profile, media);
  const latest = media[0];
  const latestDate = latest?.timestamp ? new Date(latest.timestamp).toLocaleDateString("zh-TW") : "尚未讀取到";

  return `
    <p class="eyebrow">IG DEEP DIAGNOSTIC</p>
    <h1>深度檢測完成</h1>
    <p>@${escapeHtml(profile.username || "instagram")} 的帳號資料已讀取，以下是依公開基本資料與近期內容訊號產生的初步診斷。</p>

    <div class="grid">
      <div class="stat"><small>總貼文數</small><b>${escapeHtml(profile.media_count ?? media.length)}</b></div>
      <div class="stat"><small>粉絲數</small><b>${escapeHtml(profile.followers_count ?? "待補權限")}</b></div>
      <div class="stat"><small>追蹤中</small><b>${escapeHtml(profile.follows_count ?? "待補權限")}</b></div>
      <div class="stat"><small>近期 Reels / 影片</small><b>${diagnosis.reelsCount}</b></div>
    </div>

    <div class="result">
      <span class="pill">目前主要卡點：${escapeHtml(diagnosis.label)}</span>
      <h2>${escapeHtml(diagnosis.summary)}</h2>
      <p>最新內容日期：${escapeHtml(latestDate)}。近期平均文案長度：約 ${diagnosis.avgCaptionLength} 字。</p>
    </div>

    <div class="panels">
      <div class="panel">
        <h3>深度判斷依據</h3>
        <ul>${diagnosis.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      </div>
      <div class="panel warn">
        <h3>觀看數與洞察資料</h3>
        <p>目前已先完成基本授權。若要讀取 Reels 觀看數、貼文觀看數、觸及與互動洞察，需要在 Meta 後台補開並通過 <code>instagram_business_manage_insights</code>。</p>
      </div>
    </div>

    <div class="actions">
      <a href="${siteUrl}">回到檢測頁</a>
      <a class="secondary" href="https://lin.ee/usdsl2r">1 對 1 檢測了解更多</a>
    </div>
  `;
}

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return page("無法處理", "<h1>無法處理</h1><p>請重新從檢測頁面開始授權。</p>", 405);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = context.cookies.get("ig_oauth_state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return page(
      "Instagram 授權未完成",
      `<h1>Instagram 授權未完成</h1><p>${escapeHtml(error)}</p><a href="${siteUrl}">回到檢測頁</a>`,
      400,
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return page(
      "Instagram 授權逾時",
      `<h1>授權逾時，請重新開始</h1><p>請回到檢測頁重新按「開始授權」。如果手機停在 Instagram 帳號頁，請選擇帳號後點底部「使用應用程式」。</p><a href="${siteUrl}">回到檢測頁</a>`,
      400,
    );
  }

  try {
    const token = await exchangeCode(code);
    if (!token.access_token) {
      throw new Error("missing_access_token");
    }

    const profile = await getProfile(token.access_token);
    const media = await getRecentMedia(token.access_token).catch(() => []);

    context.cookies.set({
      name: "ig_oauth_state",
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
    });

    return page("IG 深度檢測完成", renderReport(profile, media));
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return page(
      "Instagram 深度檢測失敗",
      `<h1>深度檢測暫時失敗</h1><p>授權已返回網站，但讀取資料時 Meta 回傳錯誤：</p><p><code>${escapeHtml(message)}</code></p><p>請確認授權帳號是 Instagram 專業帳號，並已接受 Instagram 測試人員邀請。</p><a href="${siteUrl}">回到檢測頁</a>`,
      500,
    );
  }
};

export const config: Config = {
  path: "/.netlify/functions/instagram-callback",
  method: ["GET"],
};
