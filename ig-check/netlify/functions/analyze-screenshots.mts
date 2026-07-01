import type { Config } from "@netlify/functions";

type UploadedImage = {
  kind?: "profile" | "reels" | "post" | "mixed";
  filename?: string;
  dataUrl?: string;
};

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isSafeImageDataUrl(value: unknown) {
  return typeof value === "string" && /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value);
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string") return response.output_text;
  const chunks: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
      if (typeof content?.json === "object") return JSON.stringify(content.json);
    }
  }
  return chunks.join("\n");
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["images"],
  properties: {
    images: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "image_index",
          "kind",
          "account_handle",
          "display_name",
          "posts_count",
          "followers_count",
          "followers_raw",
          "following_count",
          "profile_bio",
          "reels_view_counts",
          "post_view_counts",
          "visible_text",
          "industry_signals",
          "cta_signals",
          "confidence_notes",
        ],
        properties: {
          image_index: { type: "integer" },
          kind: { type: "string", enum: ["profile", "reels", "post", "mixed"] },
          account_handle: { type: ["string", "null"] },
          display_name: { type: ["string", "null"] },
          posts_count: { type: ["number", "null"] },
          followers_count: { type: ["number", "null"] },
          followers_raw: { type: ["string", "null"] },
          following_count: { type: ["number", "null"] },
          profile_bio: { type: ["string", "null"] },
          reels_view_counts: {
            type: "array",
            items: { type: "number" },
          },
          post_view_counts: {
            type: "array",
            items: { type: "number" },
          },
          visible_text: { type: "string" },
          industry_signals: {
            type: "array",
            items: { type: "string" },
          },
          cta_signals: {
            type: "array",
            items: { type: "string" },
          },
          confidence_notes: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const visionPrompt = [
  "你是 Instagram 帳號截圖辨識助手。請只根據圖片中看得到的公開資訊輸出 JSON，不要猜測。",
  "每張圖可能是帳號首頁、Reels 排版頁、單則 Reels、單則貼文、或混合截圖。",
  "請精準讀取：帳號名稱、顯示名稱、貼文總數、粉絲數、追蹤中數、簡介文字、Reels 觀看數、貼文/影片觀看數、行動引導文字。",
  "帳號首頁通常會有三個主數字：貼文、粉絲、追蹤中。中文介面可能寫成「貼文」「位粉絲」「追蹤中」。",
  "Reels 排版頁或 Reels 截圖的觀看數常在影片左下角，旁邊可能有播放、眼睛或 Reels 圖示。請把所有清楚可見的觀看數放到 reels_view_counts。",
  "貼文或影片截圖若有觀看數或互動數，請放到 post_view_counts。不要把時間、電量、通知數、頁籤數誤當成觀看數。",
  "數字換算必須精準：71.6K=71600、69.6K=69600、35.7K=35700、1.2萬=12000、3.5萬=35000、4.6萬=46000、1M=1000000、1百萬=1000000。",
  "若數字被遮住、模糊或不確定，請填 null 或略過該觀看數，並在 confidence_notes 說明原因。",
  "industry_signals 請根據簡介、標題與畫面文字判斷產業線索，例如音樂、教育、美業、車業、房仲、電商、醫美、餐飲、身心靈、個人創作者等。",
  "cta_signals 請列出是否看到私訊、預約、報名、購買、合作、連結、LINE、Email 等行動引導。",
  "請嚴格符合提供的 JSON schema。",
].join("\n");

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ success: false, error: "OpenAI Vision 尚未啟用：缺少 OPENAI_API_KEY" }, 500);
  }

  let body: { images?: UploadedImage[] };
  try {
    body = await req.json();
  } catch (error) {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const images = (body.images || []).slice(0, 3);
  if (!images.length) {
    return json({ success: false, error: "No images uploaded" }, 400);
  }
  if (images.some((image) => !isSafeImageDataUrl(image.dataUrl))) {
    return json({ success: false, error: "Only PNG, JPG, or WEBP image data URLs are allowed" }, 400);
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: visionPrompt,
    },
  ];

  images.forEach((image, index) => {
    content.push({
      type: "input_text",
      text: `Image ${index + 1}: kind=${image.kind || "mixed"}, filename=${image.filename || ""}`,
    });
    content.push({
      type: "input_image",
      image_url: image.dataUrl,
      detail: "high",
    });
  });

  const model = Netlify.env.get("OPENAI_VISION_MODEL") || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "ig_screenshot_analysis",
          strict: true,
          schema,
        },
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({
      success: false,
      error: result?.error?.message || "OpenAI Vision request failed",
    }, 502);
  }

  try {
    const outputText = extractOutputText(result);
    const parsed = JSON.parse(outputText);
    const outputImages = (parsed.images || []).map((image: Record<string, unknown>, index: number) => ({
      ...image,
      kind: image.kind || images[index]?.kind || "mixed",
    }));
    return json({
      success: true,
      source: "openai_vision",
      model,
      images: outputImages,
    });
  } catch (error) {
    return json({ success: false, error: "OpenAI Vision response could not be parsed" }, 502);
  }
};

export const config: Config = {
  path: "/api/analyze-screenshots",
  method: ["POST"],
};
