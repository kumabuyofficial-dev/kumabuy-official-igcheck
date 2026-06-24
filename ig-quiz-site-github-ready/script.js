const labels = {
  content: "1 內容",
  positioning: "2 定位",
  conversion: "3 流量轉換",
};

const summaries = {
  content:
    "你的帳號目前最需要優先檢查的是內容吸引力。基礎快篩顯示，帳號名稱可能還不足以讓人立刻感受到內容亮點，下一步可以先檢查貼文主題、開場標題、系列感與收藏價值。",
  positioning:
    "你的帳號目前最需要優先檢查的是帳號定位。基礎快篩顯示，帳號名稱或網址訊號可能還不夠清楚，讓陌生人不一定能快速理解你是誰、幫助誰、提供什麼價值。",
  conversion:
    "你的帳號目前最需要優先檢查的是流量轉換。基礎快篩顯示，你的帳號可能已有商業或服務訊號，下一步要確認簡介、連結、私訊引導與預約路徑是否足夠清楚。",
};

const basisText = {
  content: "帳號名稱偏向內容或生活訊號，建議先檢查內容主題是否穩定、貼文是否有明確鉤子，以及每篇是否讓人想收藏或分享。",
  positioning: "帳號名稱可辨識度偏弱或符號較多，建議先檢查受眾、專長、關鍵字與帳號主軸是否能被陌生人快速理解。",
  conversion: "帳號名稱帶有品牌、商店、服務或官方訊號，建議先檢查簡介 CTA、連結入口、私訊關鍵字與成交承接流程。",
};

function getResultSummary(type, hasScreenshot, industry) {
  if (!hasScreenshot) return summaries[type];

  const industryText = industry && industry.confidence !== "low" ? `，且截圖線索偏向「${industry.label}」` : "";
  const summaryByType = {
    content:
      `你的帳號目前最需要優先檢查的是內容吸引力。這次會以截圖中可見的首頁文字、貼文數、觀看數與內容線索做初步判斷${industryText}，下一步建議先檢查內容主題、作品呈現與短影音開頭是否能讓陌生人想繼續看。`,
    positioning:
      `你的帳號目前最需要優先檢查的是帳號定位。這次會以截圖中可見的簡介、行業線索、粉絲量級與首頁資訊做初步判斷${industryText}，下一步建議先讓陌生人 5 秒內看懂你是誰、幫誰、提供什麼。`,
    conversion:
      `你的帳號目前最需要優先檢查的是流量轉換。這次會以截圖中可見的觀看數、粉絲量級、簡介與行動引導做初步判斷${industryText}，下一步建議先檢查 LINE、私訊、預約或購買路徑是否清楚。`,
  };
  return summaryByType[type];
}

const result = document.querySelector("#result");
const form = document.querySelector("#quizForm");
const igUrlInput = document.querySelector("#igUrl");
const previewBtn = document.querySelector("#previewBtn");
const screenshotInputs = [...document.querySelectorAll("[data-screenshot-input]")];
const ocrStatus = document.querySelector("#ocrStatus");
const ocrTextField = document.querySelector("#ocr_text");
const ocrMetricsField = document.querySelector("#ocr_metrics");
let latestResult = null;
let revealResultAnimation = null;
let playScanAnimation = null;
let screenshotAnalysis = {
  text: "",
  metrics: {},
  files: 0,
  ready: false,
  loading: false,
  error: "",
};

function initGsapAnimations() {
  if (!window.gsap) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("gsap-ready");
  gsap.defaults({ ease: "power3.out", duration: reduceMotion ? 0 : 0.75 });

  gsap.set([".hero-copy > *", ".hero-visual", ".quiz-shell", ".scan-overlay"], { autoAlpha: 0 });
  gsap.set(".cursor-glow", { xPercent: -50, yPercent: -50 });

  const intro = gsap.timeline();
  intro
    .fromTo(".launch-bar span", { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, stagger: 0.12, duration: reduceMotion ? 0 : 0.5 })
    .fromTo("h1", { autoAlpha: 0, y: 45, scale: 0.94, filter: "blur(14px)" }, { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: reduceMotion ? 0 : 0.9 }, "-=0.1")
    .to(".hero-copy > *", {
      autoAlpha: 1,
      y: 0,
      stagger: 0.08,
      duration: reduceMotion ? 0 : 0.7,
      clearProps: "transform,visibility,opacity",
    }, "-=0.45")
    .fromTo(
      ".hero-copy > *",
      { y: 28 },
      { y: 0, stagger: 0.08, duration: reduceMotion ? 0 : 0.7, clearProps: "transform" },
      0,
    )
    .to(".hero-visual", { autoAlpha: 1, y: 0, scale: 1, duration: reduceMotion ? 0 : 0.9 }, "<0.15")
    .fromTo(".hero-visual", { y: 50, scale: 0.96 }, { y: 0, scale: 1, duration: reduceMotion ? 0 : 0.9 }, "<")
    .to(".quiz-shell", { autoAlpha: 1, y: 0, duration: reduceMotion ? 0 : 0.75 }, "-=0.35")
    .fromTo(".quiz-shell", { y: 30 }, { y: 0, duration: reduceMotion ? 0 : 0.75 }, "<");

  if (!reduceMotion) {
    const xTo = gsap.quickTo(".cursor-glow", "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(".cursor-glow", "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("mousemove", (event) => {
      xTo(event.clientX);
      yTo(event.clientY);
    });

    gsap.to(".device-frame", {
      y: -12,
      rotation: 0.6,
      duration: 3.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    gsap.to(".stage-halo", {
      scale: 1.04,
      duration: 4.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    gsap.to(".hud-stack span", {
      x: -10,
      duration: 1.7,
      repeat: -1,
      yoyo: true,
      stagger: 0.18,
      ease: "sine.inOut",
    });
  }

  document.querySelectorAll(".auth-button, #previewBtn").forEach((element) => {
    element.addEventListener("mouseenter", () => gsap.to(element, { y: -3, scale: 1.02, duration: 0.22 }));
    element.addEventListener("mouseleave", () => gsap.to(element, { y: 0, scale: 1, duration: 0.22 }));
  });

  igUrlInput.addEventListener("focus", () => {
    gsap.to(".instant-check", { boxShadow: "0 0 70px rgba(0, 183, 168, 0.24)", duration: 0.35 });
  });
  igUrlInput.addEventListener("blur", () => {
    gsap.to(".instant-check", { boxShadow: "0 18px 42px rgba(0, 0, 0, 0.16)", duration: 0.35 });
  });

  revealResultAnimation = () => {
    gsap.fromTo(
      "#result",
      { autoAlpha: 0.2, y: 40, scale: 0.94, rotationX: -12, transformPerspective: 900 },
      { autoAlpha: 1, y: 0, scale: 1, rotationX: 0, duration: reduceMotion ? 0 : 0.7, ease: "back.out(1.35)" },
    );
    gsap.fromTo(
      "#result .basis-box, #result .score-grid span, #result .account-chip",
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, stagger: 0.055, duration: reduceMotion ? 0 : 0.42, ease: "power2.out" },
    );
  };

  playScanAnimation = (onComplete) => {
    if (reduceMotion) {
      onComplete();
      return;
    }

    const tl = gsap.timeline({ onComplete });
    tl.set(".scan-overlay", { autoAlpha: 1 })
      .set(".scan-beam", { yPercent: -120 })
      .to("#previewBtn", { scale: 0.94, duration: 0.12 })
      .to("#previewBtn", { scale: 1, duration: 0.22, ease: "back.out(2)" })
      .fromTo(".scan-panel", { autoAlpha: 0, y: 18, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.28 }, 0)
      .to(".scan-beam", { yPercent: 140, duration: 0.85, ease: "power2.inOut" }, 0.08)
      .to(".scan-panel i", { scaleX: 1, duration: 0.72, transformOrigin: "left center", ease: "power2.inOut" }, 0.12)
      .to(".scan-overlay", { autoAlpha: 0, duration: 0.28 }, "+=0.05")
      .set(".scan-panel i", { scaleX: 0 });
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseInstagramInput(value) {
  const raw = value.trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com") return null;
    const handle = (url.pathname.split("/").filter(Boolean)[0] || "").replace(/^@+/, "").toLowerCase();
    const blockedPaths = new Set([
      "about",
      "accounts",
      "developer",
      "direct",
      "explore",
      "p",
      "reel",
      "reels",
      "stories",
    ]);
    if (blockedPaths.has(handle)) return null;
    if (!/^[a-z0-9._]{2,30}$/.test(handle)) return null;
    return handle;
  } catch (error) {
    return null;
  }
}

async function lookupInstagramAccount(handle) {
  const response = await fetch(`/api/lookup-instagram?handle=${encodeURIComponent(handle)}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "無法確認這個 IG 帳號");
  }
  return payload;
}

function parseCompactNumber(value) {
  if (!value) return null;
  const source = String(value).replace(/,/g, "").replace(/\s+/g, "").trim();
  const match = source.match(/(\d+(?:\.\d+)?)\s*([萬万kKmM]?)/);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;

  const unit = match[2].toLowerCase();
  if (unit === "萬" || unit === "万") return Math.round(number * 10000);
  if (unit === "k") return Math.round(number * 1000);
  if (unit === "m") return Math.round(number * 1000000);
  return Math.round(number);
}

function parseCompactNumberStrict(value) {
  const source = String(value || "").replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!/^\d+(?:\.\d+)?(?:萬|万|k|K|m|M)?$/.test(source)) return null;
  return parseCompactNumber(source);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "未明顯讀到";
  return value.toLocaleString("zh-Hant");
}

function uniqueNumbers(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0))];
}

function uniqueTextValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractStandaloneNumberTokens(text) {
  const candidates = text.match(/\d[\d,.]*\s*(?:萬|万|k|K|m|M)?/g) || [];
  const seen = new Set();
  return candidates
    .map((raw) => ({
      raw: raw.replace(/\s+/g, ""),
      value: parseCompactNumberStrict(raw),
    }))
    .filter((item) => {
      if (!Number.isFinite(item.value) || item.value <= 0) return false;
      const key = `${item.raw}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractStandaloneNumbers(text) {
  return uniqueNumbers(extractStandaloneNumberTokens(text).map((item) => item.value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);
}

function getViewStats(values) {
  const list = uniqueNumbers(values)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);

  if (!list.length) {
    return {
      values: [],
      count: 0,
      highest: null,
      lowest: null,
      average: null,
    };
  }

  const total = list.reduce((sum, value) => sum + value, 0);
  return {
    values: list,
    count: list.length,
    highest: list[0],
    lowest: list[list.length - 1],
    average: Math.round(total / list.length),
  };
}

function formatViewList(values, limit = 12) {
  const list = values.slice(0, limit).map(formatNumber).join(" / ");
  return values.length > limit ? `${list} / 另有 ${values.length - limit} 個` : list;
}

function extractNumbersNear(text, keywords, windowSize = 18) {
  const normalized = text.replace(/\s+/g, " ");
  const numbers = [];

  keywords.forEach((keyword) => {
    let index = normalized.indexOf(keyword);
    while (index !== -1) {
      const before = normalized.slice(Math.max(0, index - windowSize), index);
      const after = normalized.slice(index, index + windowSize);
      const candidates = `${before} ${after}`.match(/\d[\d,.]*\s*(?:萬|万|k|K|m|M)?/g) || [];
      candidates.forEach((candidate) => {
        const parsed = parseCompactNumber(candidate);
        if (parsed !== null) numbers.push(parsed);
      });
      index = normalized.indexOf(keyword, index + keyword.length);
    }
  });

  return uniqueNumbers(numbers);
}

function extractFirstByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseCompactNumber(match[1]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractFirstMetric(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = parseCompactNumberStrict(match[1]);
    if (parsed !== null) {
      return {
        value: parsed,
        raw: match[1].replace(/\s+/g, ""),
        confidence: "high",
      };
    }
  }
  return { value: null, raw: "", confidence: "none" };
}

function getFollowerTier(followers) {
  if (!Number.isFinite(followers)) return null;
  if (followers < 1000) {
    return {
      label: "起步帳號",
      detail: "目前仍在累積基礎受眾，重點是讓首頁定位清楚、內容主題穩定，先讓對的人願意追蹤。",
    };
  }
  if (followers < 10000) {
    return {
      label: "KOC / 小型創作者",
      detail: "這個階段適合建立真實信任感，作品、心得、案例與互動會比單純追求流量更重要。",
    };
  }
  if (followers < 100000) {
    return {
      label: "微型 KOL / 垂直創作者",
      detail: "已具備垂直影響力，建議檢查內容系列、合作信任證明與清楚的轉換入口。",
    };
  }
  if (followers < 500000) {
    return {
      label: "中型 KOL",
      detail: "已具備明顯觸及能力，接下來要確認受眾輪廓、商業合作承接與品牌辨識是否一致。",
    };
  }
  if (followers < 1000000) {
    return {
      label: "大型 KOL",
      detail: "帳號已進入大型曝光量級，內容策略需要兼顧大眾辨識、品牌安全與合作轉換效率。",
    };
  }
  return {
    label: "明星級 / 名人級帳號",
    detail: "帳號已屬高曝光量級，重點會放在聲量管理、品牌合作篩選與跨平台信任承接。",
  };
}

const industryCatalog = [
  {
    label: "美業服務",
    keywords: ["美甲", "凝膠", "美睫", "霧眉", "紋繡", "除毛", "美髮", "髮型", "染髮", "燙髮", "護髮", "美容", "美業"],
    advice: [
      "首頁第一眼要看得到服務項目、作品風格與預約方式，不要只放零散生活照。",
      "置頂貼文建議放作品總覽、價格或常見問題、預約流程，讓新客不用私訊才知道怎麼開始。",
      "Reels 可多做前後對比、客人需求、作品細節與保養提醒，會比單純成品照更容易建立信任。",
    ],
  },
  {
    label: "醫美 / 診所 / 健康照護",
    keywords: ["醫美", "診所", "皮秒", "音波", "電波", "玻尿酸", "肉毒", "雷射", "微整", "牙醫", "矯正", "植牙", "復健", "中醫", "營養師", "護理"],
    advice: [
      "首頁要優先建立安全感：專業資格、服務項目、案例說明與諮詢流程要清楚。",
      "內容避免只講療程名稱，建議用常見困擾、適合族群、術前術後注意事項去包裝。",
      "行動引導要明確，例如預約諮詢、LINE 詢問或官方表單，降低陌生人不敢問的門檻。",
    ],
  },
  {
    label: "保養 / SPA / 美妝",
    keywords: ["保養", "肌膚", "臉部", "芳療", "spa", "香氛", "美容師", "清粉刺", "做臉", "彩妝", "化妝", "美妝", "護膚"],
    advice: [
      "首頁要讓人看懂你主打的是保養知識、服務預約還是產品銷售。",
      "建議多放膚況問題、改善過程、客戶回饋與使用方式，讓信任感比促銷更先成立。",
      "若有預約或購買入口，簡介與置頂貼文都要一致，不要讓客人找不到下一步。",
    ],
  },
  {
    label: "汽機車 / 車行服務",
    keywords: ["中古車", "二手車", "車行", "汽車", "機車", "賞車", "貸款", "車貸", "鍍膜", "包膜", "改裝", "保養廠", "輪胎", "驗車"],
    advice: [
      "首頁要清楚呈現車源、價格區間、賞車地點與聯絡方式，讓有需求的人能直接詢問。",
      "內容建議增加成交案例、車況檢查、貸款說明與避坑知識，會比單純車照更容易轉換。",
      "每支短影音可用一個明確賣點開頭，例如年份、里程、車況、適合族群或付款方案。",
    ],
  },
  {
    label: "房地產 / 室內空間",
    keywords: ["房仲", "買房", "賣房", "租屋", "預售屋", "建案", "不動產", "房地產", "室內設計", "裝潢", "裝修", "居家", "空間設計"],
    advice: [
      "首頁要讓人知道你服務的地區、物件類型與專長，是首購、投資、租屋還是裝修。",
      "內容建議做地區行情、賞屋重點、案例解析與流程教學，讓陌生人先信任你的判斷。",
      "行動引導要具體，例如預約看屋、估價、諮詢裝修，不要只寫歡迎私訊。",
    ],
  },
  {
    label: "婚禮 / 攝影 / 活動",
    keywords: ["婚紗", "婚攝", "新秘", "婚禮", "攝影", "寫真", "寶寶攝影", "孕婦寫真", "活動企劃", "主持", "佈置", "花藝"],
    advice: [
      "首頁要先呈現作品風格、服務地區、檔期詢問方式與代表作品。",
      "內容可多放完整案例故事、拍攝前後、客戶需求與成品差異，讓作品不只是一張漂亮照片。",
      "置頂貼文建議放服務方案、常見問題與預約流程，減少客戶詢問成本。",
    ],
  },
  {
    label: "課程 / 顧問 / 知識服務",
    keywords: ["課程", "教練", "顧問", "諮詢", "講師", "培訓", "教學", "學習", "線上課", "工作坊", "行銷", "創業", "職涯", "財商"],
    advice: [
      "首頁第一句要講清楚你幫誰解決什麼問題，不要只列身份頭銜。",
      "內容要增加案例、前後差異、學員成果與具體方法，讓專業變得可感知。",
      "轉換入口建議聚焦一個主行動，例如領取資源、預約諮詢或報名課程。",
    ],
  },
  {
    label: "電商 / 零售 / 品牌商品",
    keywords: ["電商", "選物", "團購", "代購", "服飾", "飾品", "包包", "鞋", "商品", "新品", "下單", "免運", "官網", "蝦皮", "賣場", "品牌"],
    advice: [
      "首頁要明確呈現主打商品、適合誰、購買入口與信任證明。",
      "內容建議多做使用情境、比較、開箱、評價與搭配教學，不要只放商品照。",
      "若有促銷活動，貼文標題和限動入口要一致，讓想買的人不用找很久。",
    ],
  },
  {
    label: "餐飲 / 食品 / 在地店家",
    keywords: ["餐廳", "咖啡", "甜點", "飲料", "小吃", "早午餐", "料理", "烘焙", "食品", "便當", "酒吧", "訂位", "外送", "菜單"],
    advice: [
      "首頁要看得到品項、地點、營業時間、訂位或外送方式。",
      "內容建議用招牌品項、製作過程、客人回饋與到店情境來提高記憶點。",
      "如果是店家帳號，精選動態保留菜單、交通、訂位與評價會更容易轉換。",
    ],
  },
  {
    label: "健身 / 運動 / 身體管理",
    keywords: ["健身", "教練", "瑜珈", "皮拉提斯", "重訓", "減脂", "增肌", "運動", "體態", "拳擊", "跑步", "營養", "體能"],
    advice: [
      "首頁要講清楚服務對象，例如減脂、體態、產後、銀髮或運動表現。",
      "內容建議多放動作教學、學員成果、常見錯誤與訓練前後變化。",
      "轉換入口要明確說明如何預約體驗、諮詢或加入課程。",
    ],
  },
  {
    label: "身心靈 / 命理 / 宗教文化",
    keywords: ["塔羅", "占星", "紫微", "命理", "水晶", "能量", "靈氣", "療癒", "身心靈", "冥想", "風水", "八字", "收驚", "宮廟"],
    advice: [
      "首頁要讓人理解你的服務方式、適合什麼困擾，以及預約流程。",
      "內容建議用情境問題、案例故事與解讀示範來建立信任，不要只放抽象語句。",
      "行動引導要清楚，例如預約諮詢、填表或加入 LINE，讓有需求的人知道下一步。",
    ],
  },
  {
    label: "旅遊 / 住宿 / 生活體驗",
    keywords: ["旅遊", "旅行", "住宿", "民宿", "飯店", "露營", "景點", "導覽", "行程", "機票", "自由行", "出國"],
    advice: [
      "首頁要清楚區分你是分享攻略、販售行程、住宿品牌或個人紀錄。",
      "內容建議強化地點、預算、交通、適合族群與真實體驗，讓收藏價值更高。",
      "若有商業轉換，連結入口要直接對應訂房、行程詢問或合作邀約。",
    ],
  },
  {
    label: "音樂 / 娛樂 / 影視內容",
    keywords: ["音樂", "歌手", "歌曲", "歌單", "聽音樂", "j-pop", "k-pop", "華語音樂", "電影", "影視", "追劇", "動漫", "偶像", "藝人", "演唱會", "podcast"],
    advice: [
      "首頁要讓人一眼知道你主打的是歌曲推薦、歌手介紹、歌單整理、影視評論還是娛樂整理。",
      "Reels 建議固定封面格式與系列名稱，讓觀眾看到第一秒就知道這是你的內容。",
      "如果想接合作，簡介要具體寫出合作方式，例如音樂推廣、歌單曝光、內容置入或跨平台導流。",
    ],
  },
  {
    label: "親子 / 教育 / 才藝",
    keywords: ["親子", "媽媽", "育兒", "兒童", "幼兒", "才藝", "補習", "英文", "數學", "音樂", "鋼琴", "畫畫", "安親", "托嬰"],
    advice: [
      "首頁要讓家長快速知道年齡層、課程內容、地點與報名方式。",
      "內容建議多放學習成果、課堂片段、常見問題與家長回饋。",
      "信任感比促銷更重要，建議置頂放師資、環境、課程流程與安全說明。",
    ],
  },
  {
    label: "專業服務 / B2B",
    keywords: ["法律", "律師", "會計", "記帳", "保險", "貸款", "理財", "人資", "系統", "軟體", "saas", "企業", "顧問", "代辦", "翻譯"],
    advice: [
      "首頁要先說清楚服務對象、解決問題與可信任的專業證明。",
      "內容建議用案例、常見錯誤、流程拆解與風險提醒，降低陌生人諮詢門檻。",
      "轉換路徑要正式清楚，例如預約諮詢、填表、下載資料或加入官方 LINE。",
    ],
  },
  {
    label: "設計 / 創意 / 媒體製作",
    keywords: ["設計", "平面", "品牌設計", "視覺", "剪輯", "影片", "動畫", "攝影", "文案", "企劃", "社群", "自媒體", "podcast", "節目"],
    advice: [
      "首頁要清楚呈現你提供的創意服務、作品風格、合作流程與代表案例。",
      "內容建議多放作品前後差異、製作過程、客戶目標與成果，而不只是展示成品。",
      "如果是個人創作者，要固定內容主軸與系列名稱，讓觀眾知道追蹤你會得到什麼。",
    ],
  },
  {
    label: "個人創作者 / 生活內容",
    keywords: ["生活", "日常", "vlog", "開箱", "分享", "穿搭", "母嬰", "學生", "上班族", "創作者", "部落客", "influencer"],
    advice: [
      "首頁要把生活內容整理成可辨識主題，例如穿搭、旅遊、職場、親子或開箱。",
      "內容標題要反覆出現同一群人的需求，讓對的人知道這個帳號和自己有關。",
      "若想接合作，建議補上合作方式、受眾特色與代表內容，讓品牌更容易判斷。",
    ],
  },
];

function detectIndustry(text, handle) {
  const source = `${text || ""} ${handle || ""}`.toLowerCase();
  const ranked = industryCatalog
    .map((industry) => {
      const matches = industry.keywords.filter((keyword) => source.includes(keyword.toLowerCase()));
      return {
        ...industry,
        matches,
        score: matches.length,
      };
    })
    .filter((industry) => industry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return {
      label: "尚未穩定判斷行業",
      confidence: "low",
      matches: [],
      advice: [
        "截圖中可讀到的行業線索不足，建議補上帳號首頁、簡介、精選動態或代表貼文截圖。",
        "首頁需要明確出現服務項目、作品類型、受眾或商品類別，系統才比較能判斷行業方向。",
        "在資訊不足時，先把簡介改成「我幫誰解決什麼問題」，會比放情緒句更容易被理解。",
      ],
    };
  }

  const top = ranked[0];
  return {
    label: top.label,
    confidence: top.score >= 3 ? "high" : "medium",
    matches: top.matches.slice(0, 6),
    advice: top.advice,
  };
}

function pickViewCountFromText(text, kind) {
  const labeledViews = extractNumbersNear(text, ["觀看", "瀏覽", "views", "view", "次觀看", "播放", "plays", "play"], 36)
    .filter((value) => value > 0);
  if (labeledViews.length) {
    const stats = getViewStats(labeledViews);
    return {
      views: stats.values,
      latestView: stats.average,
      highestView: stats.highest,
      lowestView: stats.lowest,
      averageView: stats.average,
      viewConfidence: "high",
      viewStats: stats,
    };
  }

  if (kind === "reels" || kind === "post") {
    const standalone = extractStandaloneNumberTokens(text)
      .filter((item) => item.value >= 100 && item.value <= 100000000)
      .filter((item) => /[萬万kKmM,]/.test(item.raw) || item.value >= 100)
      .map((item) => item.value);
    const stats = getViewStats(standalone);
    if (stats.count) {
      return {
        views: stats.values,
        latestView: stats.average,
        highestView: stats.highest,
        lowestView: stats.lowest,
        averageView: stats.average,
        viewConfidence: "medium",
        viewStats: stats,
      };
    }
  }

  return {
    views: [],
    latestView: null,
    highestView: null,
    lowestView: null,
    averageView: null,
    viewConfidence: "none",
    viewStats: getViewStats([]),
  };
}

function extractScreenshotMetrics(rawText, kind = "mixed") {
  const text = rawText.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const directFollowers = extractFirstMetric(text, [
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*(?:位)?\s*(?:粉絲|追蹤者)/i,
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*followers?/i,
  ]);
  const directFollowing = extractFirstByPatterns(text, [
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*追蹤中/,
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*following/i,
  ]);
  const directPosts = extractFirstByPatterns(text, [
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*貼文/,
    /(\d[\d,.]*\s*(?:萬|万|k|K|m|M)?)\s*posts?/i,
  ]);
  const followingCandidates = extractNumbersNear(text, ["追蹤中", "following"]);
  const postCandidates = extractNumbersNear(text, ["貼文", "posts", "post"]);
  const viewResult = pickViewCountFromText(text, kind);
  const ctaKeywords = ["line", "lin.ee", "私訊", "dm", "預約", "諮詢", "購買", "報名", "連結", "官網", "表單", "合作"];
  const bioKeywords = ["podcast", "教學", "課程", "顧問", "品牌", "美甲", "保養", "穿搭", "旅遊", "行銷", "創業", "設計"];
  const ctaMatches = ctaKeywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const bioMatches = bioKeywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const followerTier = getFollowerTier(directFollowers.value);

  return {
    followers: directFollowers.value,
    followerRaw: directFollowers.raw,
    followerConfidence: directFollowers.confidence,
    followerTier,
    following: directFollowing ?? followingCandidates[0] ?? null,
    posts: directPosts ?? postCandidates[0] ?? null,
    views: viewResult.views,
    latestView: viewResult.latestView,
    highestView: viewResult.highestView,
    lowestView: viewResult.lowestView,
    averageView: viewResult.averageView,
    viewStats: viewResult.viewStats,
    viewConfidence: viewResult.viewConfidence,
    ctaMatches,
    bioMatches,
    hasCta: ctaMatches.length > 0,
    hasBioSignal: bioMatches.length > 0,
  };
}

function buildScreenshotEvidence(metrics, files, industry) {
  const rows = [`已讀取截圖：${files} 張`];
  if (metrics.followers !== null && metrics.followers !== undefined) {
    rows.push(`粉絲數：${formatNumber(metrics.followers)}${metrics.followerRaw ? `（畫面顯示 ${metrics.followerRaw}）` : ""}`);
  } else {
    rows.push("粉絲數：這次截圖沒有清楚讀到");
  }
  if (metrics.followerTier) rows.push(`帳號量級：${metrics.followerTier.label}`);
  if (metrics.posts !== null && metrics.posts !== undefined) rows.push(`貼文數：${formatNumber(metrics.posts)}`);
  if (metrics.reelsViewStats?.count) {
    rows.push(`Reels 觀看數列表：${formatViewList(metrics.reelsViewStats.values)}`);
    rows.push(`Reels 最高 / 平均 / 最低：${formatNumber(metrics.reelsViewStats.highest)} / 約 ${formatNumber(metrics.reelsViewStats.average)} / ${formatNumber(metrics.reelsViewStats.lowest)}`);
  } else {
    rows.push("Reels 觀看數：這次截圖沒有清楚讀到");
  }
  if (metrics.postViewStats?.count) {
    rows.push(`貼文觀看數列表：${formatViewList(metrics.postViewStats.values)}`);
    rows.push(`貼文最高 / 平均 / 最低：${formatNumber(metrics.postViewStats.highest)} / 約 ${formatNumber(metrics.postViewStats.average)} / ${formatNumber(metrics.postViewStats.lowest)}`);
  } else {
    rows.push("貼文觀看數：這次截圖沒有清楚讀到");
  }
  if (industry) {
    rows.push(
      industry.confidence === "low"
        ? "行業判斷：截圖線索不足，尚無法穩定判斷"
        : `行業判斷：${industry.label}${industry.matches.length ? `（依據：${industry.matches.join(" / ")}）` : ""}`,
    );
  }
  rows.push(metrics.hasCta ? `讀到行動引導：${metrics.ctaMatches.slice(0, 4).join(" / ")}` : "未明顯讀到私訊、連結、預約或購買等行動引導");
  rows.push(metrics.hasBioSignal ? `讀到內容或定位關鍵字：${metrics.bioMatches.slice(0, 4).join(" / ")}` : "未明顯讀到可辨識的內容主題或定位關鍵字");
  return rows;
}

function buildOcrStatusText(metrics, files) {
  const parts = [`已讀取 ${files} 張截圖`];
  parts.push(Number.isFinite(metrics.followers)
    ? `粉絲數 ${formatNumber(metrics.followers)}`
    : "粉絲數尚未清楚讀到");
  parts.push(Number.isFinite(metrics.posts)
    ? `貼文數 ${formatNumber(metrics.posts)}`
    : "貼文數尚未清楚讀到");
  if (metrics.reelsViewStats?.count) {
    parts.push(`Reels 觀看數 ${formatViewList(metrics.reelsViewStats.values, 8)}`);
    parts.push(`Reels 平均約 ${formatNumber(metrics.reelsViewStats.average)}`);
  } else {
    parts.push("Reels 觀看數尚未上傳或未清楚讀到");
  }
  if (metrics.postViewStats?.count) {
    parts.push(`貼文觀看數 ${formatViewList(metrics.postViewStats.values, 8)}`);
    parts.push(`貼文平均約 ${formatNumber(metrics.postViewStats.average)}`);
  } else {
    parts.push("貼文觀看數尚未上傳或未清楚讀到");
  }
  return `${parts.join("，")}。`;
}

async function prepareImageForOcr(file) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = imageUrl;
    await image.decode();

    const scale = Math.min(3, Math.max(1.7, 1700 / Math.max(image.width, image.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.45 + 128));
      data[index] = contrast;
      data[index + 1] = contrast;
      data[index + 2] = contrast;
    }
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function normalizeVisionNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  return parseCompactNumberStrict(value) ?? parseCompactNumber(value);
}

function metricsFromVisionImage(image) {
  const kind = image.kind || "mixed";
  const reelsViews = uniqueNumbers((image.reels_view_counts || []).map(normalizeVisionNumber))
    .filter((value) => Number.isFinite(value) && value > 0);
  const postViews = uniqueNumbers((image.post_view_counts || []).map(normalizeVisionNumber))
    .filter((value) => Number.isFinite(value) && value > 0);
  const visibleText = [
    image.visible_text,
    image.profile_bio,
    ...(image.industry_signals || []),
    ...(image.cta_signals || []),
  ].filter(Boolean).join(" ");
  const fallbackMetrics = extractScreenshotMetrics(visibleText, kind);
  const followers = normalizeVisionNumber(image.followers_count);
  const posts = normalizeVisionNumber(image.posts_count);
  const views = kind === "post" ? postViews : kind === "reels" ? reelsViews : [...reelsViews, ...postViews];

  return {
    ...fallbackMetrics,
    accountHandle: (image.account_handle || fallbackMetrics.accountHandle || "").replace(/^@+/, "").toLowerCase(),
    displayName: image.display_name || fallbackMetrics.displayName || "",
    followers: followers ?? fallbackMetrics.followers,
    followerRaw: image.followers_raw || fallbackMetrics.followerRaw,
    followerConfidence: followers ? "high" : fallbackMetrics.followerConfidence,
    followerTier: getFollowerTier(followers) || fallbackMetrics.followerTier,
    posts: posts ?? fallbackMetrics.posts,
    views: views.length ? views : fallbackMetrics.views,
    latestView: views.length ? getViewStats(views).average : fallbackMetrics.latestView,
    highestView: views.length ? getViewStats(views).highest : fallbackMetrics.highestView,
    viewConfidence: views.length ? "high" : fallbackMetrics.viewConfidence,
    ctaMatches: uniqueTextValues([...(image.cta_signals || []), ...(fallbackMetrics.ctaMatches || [])]),
    bioMatches: uniqueTextValues([...(image.industry_signals || []), ...(fallbackMetrics.bioMatches || [])]),
    hasCta: (image.cta_signals || []).length > 0 || fallbackMetrics.hasCta,
    hasBioSignal: (image.industry_signals || []).length > 0 || fallbackMetrics.hasBioSignal,
  };
}

function combineScreenshotMetrics(text, metricsByKind) {
  const mixedMetrics = extractScreenshotMetrics(text, "mixed");
  const profileMetrics = metricsByKind.profile || {};
  const reelsMetrics = metricsByKind.reels || {};
  const postMetrics = metricsByKind.post || {};
  const reelsViewStats = getViewStats(reelsMetrics.views || []);
  const postViewStats = getViewStats(postMetrics.views || []);
  const mixedViewStats = getViewStats(mixedMetrics.views || []);
  const followers = profileMetrics.followers ?? mixedMetrics.followers;
  const metrics = {
    ...mixedMetrics,
    accountHandle: profileMetrics.accountHandle || mixedMetrics.accountHandle || "",
    displayName: profileMetrics.displayName || mixedMetrics.displayName || "",
    followers,
    followerRaw: profileMetrics.followerRaw || mixedMetrics.followerRaw,
    followerConfidence: profileMetrics.followerConfidence || mixedMetrics.followerConfidence,
    followerTier: profileMetrics.followerTier || mixedMetrics.followerTier || getFollowerTier(followers),
    posts: profileMetrics.posts ?? mixedMetrics.posts,
    reelsViews: reelsViewStats.values,
    reelsViewStats,
    reelsView: reelsViewStats.average ?? null,
    reelsViewConfidence: reelsMetrics.viewConfidence || "none",
    postViews: postViewStats.values,
    postViewStats,
    postView: postViewStats.average ?? null,
    postViewConfidence: postMetrics.viewConfidence || "none",
    latestView: reelsViewStats.average ?? postViewStats.average ?? mixedViewStats.average ?? mixedMetrics.latestView,
    highestView: Math.max(
      reelsViewStats.highest || 0,
      postViewStats.highest || 0,
      mixedViewStats.highest || 0,
    ) || null,
    views: [
      ...reelsViewStats.values,
      ...postViewStats.values,
      ...mixedViewStats.values,
    ],
    ctaMatches: uniqueTextValues([
      ...(profileMetrics.ctaMatches || []),
      ...(reelsMetrics.ctaMatches || []),
      ...(postMetrics.ctaMatches || []),
      ...(mixedMetrics.ctaMatches || []),
    ]),
    bioMatches: uniqueTextValues([
      ...(profileMetrics.bioMatches || []),
      ...(reelsMetrics.bioMatches || []),
      ...(postMetrics.bioMatches || []),
      ...(mixedMetrics.bioMatches || []),
    ]),
  };
  metrics.hasCta = metrics.ctaMatches.length > 0;
  metrics.hasBioSignal = metrics.bioMatches.length > 0;
  return metrics;
}

async function analyzeScreenshotsWithVision(selectedScreenshots) {
  const images = [];
  for (const item of selectedScreenshots) {
    const preparedImage = await prepareImageForOcr(item.file);
    let dataUrl = preparedImage;
    if (preparedImage instanceof File) {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(preparedImage);
      });
    }
    images.push({
      kind: item.kind,
      filename: item.file.name,
      dataUrl,
    });
  }

  const response = await fetch("/api/analyze-screenshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Vision analysis failed");
  }

  const textParts = [];
  const metricsByKind = {};
  (payload.images || []).forEach((image) => {
    const kind = image.kind || "mixed";
    const visibleText = [
      image.visible_text,
      image.profile_bio,
      ...(image.industry_signals || []),
      ...(image.cta_signals || []),
    ].filter(Boolean).join(" ");
    textParts.push(visibleText);
    metricsByKind[kind] = metricsFromVisionImage(image);
  });

  const text = textParts.join("\n");
  return {
    text,
    metrics: combineScreenshotMetrics(text, metricsByKind),
    source: "vision",
  };
}

async function readScreenshots() {
  const selectedScreenshots = screenshotInputs
    .map((input) => ({
      file: input.files?.[0],
      kind: input.dataset.screenshotKind || "mixed",
    }))
    .filter((item) => item.file);
  const files = selectedScreenshots.map((item) => item.file);
  screenshotAnalysis = {
    text: "",
    metrics: {},
    files: files.length,
    ready: false,
    loading: false,
    error: "",
  };

  if (!files.length) {
    ocrStatus.className = "ocr-status";
    ocrStatus.textContent = "尚未上傳截圖。系統會先確認 IG 帳號是否有公開搜尋結果。";
    ocrTextField.value = "";
    ocrMetricsField.value = "";
    return;
  }

  screenshotAnalysis.loading = true;
  ocrStatus.className = "ocr-status is-loading";
  ocrStatus.textContent = `正在讀取 ${files.length} 張截圖，請稍等幾秒...`;

  try {
    ocrStatus.textContent = `正在用 AI Vision 讀取 ${files.length} 張截圖...`;
    const visionResult = await analyzeScreenshotsWithVision(selectedScreenshots);
    screenshotAnalysis = {
      text: visionResult.text,
      metrics: visionResult.metrics,
      files: files.length,
      ready: true,
      loading: false,
      error: "",
      source: "vision",
    };
    ocrTextField.value = visionResult.text.slice(0, 6000);
    ocrMetricsField.value = JSON.stringify(visionResult.metrics);
    ocrStatus.className = "ocr-status is-ready";
    ocrStatus.textContent = `AI Vision：${buildOcrStatusText(visionResult.metrics, files.length)}`;
    return;
  } catch (visionError) {
    ocrStatus.textContent = "AI Vision 暫時無法讀取，正在改用備援 OCR...";
  }

  if (!window.Tesseract) {
    screenshotAnalysis.error = "截圖讀取工具尚未載入";
    ocrStatus.className = "ocr-status is-error";
    ocrStatus.textContent = "AI Vision 尚未啟用，備援 OCR 也尚未載入；請稍後重整再試。";
    return;
  }

  try {
    const textParts = [];
    const metricsByKind = {};
    for (const [index, item] of selectedScreenshots.entries()) {
      ocrStatus.textContent = `正在讀取截圖 ${index + 1}/${files.length}...`;
      const preparedImage = await prepareImageForOcr(item.file);
      const result = await window.Tesseract.recognize(preparedImage, "eng+chi_tra");
      const partText = result.data.text || "";
      textParts.push(partText);
      metricsByKind[item.kind] = extractScreenshotMetrics(partText, item.kind);
    }

    const text = textParts.join("\n");
    const metrics = combineScreenshotMetrics(text, metricsByKind);
    screenshotAnalysis = {
      text,
      metrics,
      files: files.length,
      ready: true,
      loading: false,
      error: "",
      source: "ocr",
    };
    ocrTextField.value = text.slice(0, 6000);
    ocrMetricsField.value = JSON.stringify(metrics);
    ocrStatus.className = "ocr-status is-ready";
    ocrStatus.textContent = buildOcrStatusText(metrics, files.length);
  } catch (error) {
    screenshotAnalysis = {
      text: "",
      metrics: {},
      files: files.length,
      ready: false,
      loading: false,
      error: "截圖讀取失敗",
    };
    ocrStatus.className = "ocr-status is-error";
    ocrStatus.textContent = "截圖讀取失敗，仍可先用 IG 網址做快速初篩；也可以換一張更清楚的截圖再試。";
  }
}

function addSignal(scores, notes, type, points, note) {
  scores[type] += points;
  notes.push(note);
}

function getAdvice(type) {
  const advice = {
    content: [
      "首頁先固定 3 個內容主題，不要什麼都發。讓新訪客 5 秒內看懂你主要分享什麼。",
      "下一篇 Reels 開頭先講痛點或結果，例如「你的 IG 沒人留言，通常不是演算法，而是開頭沒抓住人」。",
      "接下來 7 天做一個可收藏系列，例如清單、錯誤整理、步驟教學，觀察哪一篇被存最多。",
    ],
    positioning: [
      "把簡介第一行改成「我幫誰，解決什麼問題」，不要只放身份或情緒句。",
      "精選動態保留 3 類就好：你是誰、成功案例或作品、如何合作或開始。",
      "內容標題要反覆出現同一群人的語言，讓對的人覺得「這帳號是在講我」。",
    ],
    conversion: [
      "簡介放一個明確行動，不要同時叫人私訊、點連結、看貼文、加 LINE，先選一個主路徑。",
      "每 3 篇內容至少 1 篇要有 CTA，例如「想要我幫你看帳號，點上方連結」。",
      "把置頂貼文改成信任承接：你能幫什麼、適合誰、下一步怎麼開始。",
    ],
  };
  return advice[type];
}

function buildContextualAdvice(winner, industry, metrics, screenshotText) {
  if (!screenshotText) return getAdvice(winner);

  const text = screenshotText.toLowerCase();
  const category = industry && industry.confidence !== "low" ? industry.label : "尚未穩定判斷行業";
  const advice = [];
  const topicKeywords = uniqueTextValues([
    ...(industry?.matches || []),
    ...(metrics.bioMatches || []),
  ]).slice(0, 4);

  const categoryGuides = [
    {
      test: /音樂|娛樂|影視/.test(category) || /(j-pop|k-pop|華語音樂|歌手|歌曲|歌單|演唱會|動漫)/i.test(text),
      line: "這個帳號比較像音樂／娛樂內容整理型帳號，首頁第一句建議直接說清楚你提供的是歌曲推薦、歌手介紹、歌單整理，還是音樂冷知識，讓新訪客不用猜。",
    },
    {
      test: /美業|醫美|保養|SPA|美妝/.test(category),
      line: "這個帳號偏服務型美業或美容保養，首頁要優先讓人看到服務項目、作品風格、適合對象與預約方式，讓想預約的人不用再翻很多貼文。",
    },
    {
      test: /汽機車|車行/.test(category),
      line: "這個帳號偏車輛服務或車源內容，建議每則內容都把車款、年份、價格區間、賞車地點或聯絡方式講清楚，讓有需求的人能直接判斷是否要詢問。",
    },
    {
      test: /房地產|室內空間/.test(category),
      line: "這個帳號偏房地產或空間服務，首頁要更快交代服務地區、物件類型、預算帶或裝修風格，內容則用案例與流程建立信任。",
    },
    {
      test: /餐飲|食品|在地店家/.test(category),
      line: "這個帳號偏餐飲或店家內容，首頁要清楚放品項、地點、營業時間與訂位方式，Reels 可以多用招牌品項和到店情境提高記憶點。",
    },
    {
      test: /課程|顧問|知識服務|專業服務|B2B/.test(category),
      line: "這個帳號偏知識或專業服務，首頁第一句要改成「我幫誰解決什麼問題」，內容要多放案例、常見錯誤與具體方法，讓專業變得看得懂。",
    },
    {
      test: /電商|零售|品牌商品/.test(category),
      line: "這個帳號偏商品或品牌銷售，首頁要讓人一眼看懂主打商品、適合誰、怎麼買；內容建議多做使用情境、比較、開箱與評價。",
    },
    {
      test: /健身|運動/.test(category),
      line: "這個帳號偏健身或身體管理，首頁要說清楚服務對象與目標，例如減脂、體態、產後或運動表現；內容可多放前後變化與常見錯誤。",
    },
    {
      test: /婚禮|攝影|活動|設計|創意|媒體製作/.test(category),
      line: "這個帳號偏作品或創意服務，首頁要快速呈現作品風格、服務項目、合作流程與代表案例，讓客戶知道你適合哪一種需求。",
    },
    {
      test: /旅遊|住宿/.test(category),
      line: "這個帳號偏旅遊或體驗內容，建議把地點、預算、交通、適合族群與真實心得做成固定格式，讓內容更有收藏價值。",
    },
    {
      test: /身心靈|命理|宗教/.test(category),
      line: "這個帳號偏身心靈或命理服務，首頁要清楚說明服務方式、適合的困擾與預約流程，內容可用情境問題和案例示範建立信任。",
    },
  ];

  const matchedGuide = categoryGuides.find((item) => item.test);
  if (matchedGuide) {
    advice.push(matchedGuide.line);
  } else if (industry && industry.confidence !== "low") {
    advice.push(`依截圖線索，這個帳號較像「${category}」。建議首頁第一句先說清楚你幫誰、提供什麼、下一步怎麼開始，再把內容主題固定成 2 到 3 個系列。`);
  } else {
    advice.push("這次截圖的行業線索還不夠穩定，首頁第一句建議直接寫出你的服務、商品或內容主題，讓系統和陌生訪客都能更快理解帳號定位。");
  }

  const reelsStats = metrics.reelsViewStats;
  if (reelsStats?.count >= 2) {
    const spread = reelsStats.average ? reelsStats.highest / reelsStats.average : 1;
    if (spread >= 2) {
      advice.push(`Reels 已讀到 ${reelsStats.count} 個觀看數，最高 ${formatNumber(reelsStats.highest)}、平均約 ${formatNumber(reelsStats.average)}。建議把高觀看那幾支拆出共同元素，例如封面文字、人物辨識度、題目角度或開頭 3 秒，再做成固定系列。`);
    } else {
      advice.push(`Reels 觀看表現相對接近，平均約 ${formatNumber(reelsStats.average)}。下一步不是只追爆量，而是測試不同開頭、封面字與 CTA，找出哪種格式最能帶來追蹤或私訊。`);
    }
  } else if (reelsStats?.count === 1) {
    advice.push(`目前只讀到 1 個 Reels 觀看數：${formatNumber(reelsStats.highest)}。建議多補幾則代表性 Reels 截圖，才比較能判斷是單支題材問題，還是整體內容包裝問題。`);
  }

  if (Number.isFinite(metrics.followers)) {
    advice.push(`粉絲數讀到 ${formatNumber(metrics.followers)}，屬於「${metrics.followerTier?.label || "目前量級"}」。這個階段建議先把信任感和主題一致性做穩，再把高觀看內容導向追蹤、私訊、連結或合作詢問。`);
  }

  if (!metrics.hasCta) {
    advice.push("截圖中沒有明顯讀到私訊、連結、預約、購買或合作引導。建議首頁和置頂貼文只保留一個最重要的下一步，讓有興趣的人知道要怎麼行動。");
  } else {
    advice.push(`截圖中有讀到 ${metrics.ctaMatches.slice(0, 3).join(" / ")} 等行動引導，建議確認首頁、置頂貼文和連結頁講的是同一件事，避免流量進來後不知道下一步。`);
  }

  if (topicKeywords.length && !matchedGuide) {
    advice.push(`這次有讀到 ${topicKeywords.join(" / ")} 等線索，建議把這些關鍵字固定出現在簡介、封面標題和置頂內容中，讓定位更一致。`);
  }

  if (winner === "content") {
    advice.push("因為本次主要卡點偏內容，下一步優先檢查封面文字、開頭 3 秒、標題是否明確，以及內容是否有固定系列感。");
  } else if (winner === "positioning") {
    advice.push("因為本次主要卡點偏定位，下一步優先調整首頁第一句、精選動態分類與置頂貼文，讓陌生人更快知道這個帳號和自己有什麼關係。");
  } else {
    advice.push("因為本次主要卡點偏流量轉換，下一步優先檢查簡介連結、置頂貼文、私訊引導與合作說明，讓看完內容的人知道可以怎麼找你。");
  }

  return uniqueTextValues(advice).slice(0, 4);
}

function analyzeHandle(handle, screenshot = screenshotAnalysis) {
  const scores = { content: 34, positioning: 34, conversion: 34 };
  const notes = [];
  const hasScreenshot = screenshot.files > 0 && screenshot.ready;
  const metrics = hasScreenshot ? screenshot.metrics : {};
  const industry = hasScreenshot ? detectIndustry(screenshot.text, handle) : null;
  const words = handle.split(/[._]+/).filter(Boolean);
  const hasSeparator = /[._]/.test(handle);
  const numberCount = (handle.match(/[0-9]/g) || []).length;
  const separatorCount = (handle.match(/[._]/g) || []).length;
  const detected = {
    length: handle.length,
    separatorCount,
    numberCount,
    words: words.length || 1,
    matchedKeywords: [],
  };

  const conversionKeywords = [
    "shop",
    "store",
    "official",
    "studio",
    "brand",
    "beauty",
    "clinic",
    "course",
    "coach",
    "buy",
    "sale",
    "tw",
    "taiwan",
  ];
  const contentKeywords = ["life", "daily", "diary", "vlog", "food", "travel", "style", "reels", "blog", "share"];
  const positioningKeywords = ["official", "pro", "expert", "consult", "design", "media", "agency", "lab"];
  const matchedConversion = conversionKeywords.filter((keyword) => handle.includes(keyword));
  const matchedContent = contentKeywords.filter((keyword) => handle.includes(keyword));
  const matchedPositioning = positioningKeywords.filter((keyword) => handle.includes(keyword));
  detected.matchedKeywords = [...matchedConversion, ...matchedContent, ...matchedPositioning];

  if (!hasScreenshot) {
    if (handle.length < 5 || handle.length > 18) {
      addSignal(scores, notes, "positioning", 16, "帳號長度比較不容易一眼記住，定位清楚度需要優先檢查。");
    }

    if (numberCount >= 3 || separatorCount >= 2) {
      addSignal(scores, notes, "positioning", 18, "帳號包含較多數字或符號，陌生人可能比較難快速理解或記住。");
    }

    if (hasSeparator && words.length >= 2) {
      addSignal(scores, notes, "positioning", 9, "帳號由多個詞組成，建議確認每個關鍵字是否都能幫助受眾理解你。");
    }

    if (matchedConversion.length) {
      addSignal(scores, notes, "conversion", 24, `偵測到 ${matchedConversion.join(" / ")} 等商店、品牌、服務或官方訊號，轉換路徑會是優先檢查重點。`);
    }

    if (matchedContent.length) {
      addSignal(scores, notes, "content", 22, `偵測到 ${matchedContent.join(" / ")} 等生活、分享或內容型訊號，內容主題和系列感會影響粉絲是否留下。`);
    }

    if (matchedPositioning.length && !handle.includes("official")) {
      addSignal(scores, notes, "positioning", 14, `偵測到 ${matchedPositioning.join(" / ")} 等專業或服務關鍵字，建議確認定位是否足夠具體。`);
    }

    if (/^[a-z]+$/.test(handle) && handle.length >= 6 && handle.length <= 14) {
      addSignal(scores, notes, "content", 8, "帳號名稱簡潔，下一步可把重點放在內容是否有記憶點。");
    }
  }

  if (hasScreenshot) {
    const followers = metrics.followers;
    const latestView = metrics.latestView || metrics.highestView;
    const hasFollowerAndView = Number.isFinite(followers) && followers > 0 && Number.isFinite(latestView);
    const viewRate = hasFollowerAndView ? latestView / followers : null;

    notes.push("這次主要參考你上傳截圖中可見的首頁文字、粉絲數、貼文數、觀看數與行動引導；若截圖模糊或數字被遮住，部分資訊可能讀不到。");

    if (industry && industry.confidence !== "low") {
      addSignal(scores, notes, "positioning", 12, `截圖文字判斷你的帳號偏向「${industry.label}」，建議首頁要更快說清楚服務項目、適合對象與下一步行動。`);
    } else {
      addSignal(scores, notes, "positioning", 16, "截圖中可讀到的行業線索不足，建議首頁補上更明確的行業、服務項目、作品類型或受眾描述。");
    }

    if (metrics.followerTier) {
      notes.push(`讀取到的粉絲數為 ${formatNumber(metrics.followers)}，目前屬於「${metrics.followerTier.label}」。${metrics.followerTier.detail}`);
    } else {
      notes.push("這次截圖沒有清楚讀到粉絲數，因此不會硬套粉絲量級；建議補上帳號首頁數字較清楚的截圖。");
    }

    if (Number.isFinite(metrics.posts) && metrics.posts < 12) {
      addSignal(scores, notes, "content", 12, "截圖中貼文數偏少，內容樣本還不夠讓新訪客快速建立信任，建議先補穩定主題與置頂內容。");
    }

    if (hasFollowerAndView && viewRate < 0.08) {
      addSignal(scores, notes, "content", 28, `截圖中觀看數約為粉絲數的 ${Math.round(viewRate * 100)}%，代表內容開頭、主題包裝或系列感需要優先檢查。`);
    }

    if (hasFollowerAndView && viewRate >= 0.18 && !metrics.hasCta) {
      addSignal(scores, notes, "conversion", 24, "截圖中觀看數不算低，但沒有明顯讀到私訊、連結或預約引導，流量承接路徑需要優先檢查。");
    }

    if (!metrics.hasBioSignal) {
      addSignal(scores, notes, "positioning", 18, "截圖中沒有明顯讀到穩定的內容主題或受眾關鍵字，陌生人可能不容易理解帳號定位。");
    }

    if (!metrics.hasCta) {
      addSignal(scores, notes, "conversion", 14, "截圖中沒有明顯讀到行動引導，建議檢查簡介、置頂貼文或精選動態是否有清楚下一步。");
    }

    if (metrics.hasBioSignal && metrics.hasCta && hasFollowerAndView && viewRate >= 0.08) {
      addSignal(scores, notes, "content", 10, "截圖中已有定位與行動引導訊號，接下來可優先檢查內容本身是否能穩定帶來收藏、留言與觀看。");
    }
  } else if (screenshot.files > 0 && screenshot.error) {
    notes.push("你有上傳截圖，但這次沒有成功讀取文字；結果先以 IG 網址做快速初篩，建議換更清楚的截圖再測一次。");
  }

  if (!notes.length) {
    scores.positioning += 8;
    notes.push("目前沒有上傳可讀取的截圖，因此先用 IG 網址做快速初篩；若要讓結果更接近實際狀況，建議補上帳號首頁、Reels 或貼文觀看數截圖。");
  }

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

  return {
    winner,
    scores,
    diagnosis: labels[winner],
    summary: getResultSummary(winner, hasScreenshot, industry),
    basis: hasScreenshot
      ? "這次不是只看網址，而是優先參考截圖中可見的首頁文字、粉絲量級、觀看數、行動引導與行業線索，再整理出最需要優先檢查的方向。"
      : basisText[winner],
    notes,
    detected,
    industry,
    advice: hasScreenshot ? buildContextualAdvice(winner, industry, metrics, screenshot.text) : getAdvice(winner),
    screenshot: {
      used: hasScreenshot,
      files: screenshot.files,
      metrics,
      evidence: hasScreenshot ? buildScreenshotEvidence(metrics, screenshot.files, industry) : [],
    },
  };
}

function fillHiddenFields(handle, data) {
  document.querySelector("#instagram").value = `@${handle}`;
  document.querySelector("#display_name").value = handle;
  document.querySelector("#content_score").value = data.scores.content;
  document.querySelector("#positioning_score").value = data.scores.positioning;
  document.querySelector("#conversion_score").value = data.scores.conversion;
  document.querySelector("#diagnosis").value = data.diagnosis;
  document.querySelector("#diagnosis_summary").value = data.summary;
  document.querySelector("#industry_result").value = data.industry?.label || "";
  document.querySelector("#follower_tier").value = data.screenshot.metrics?.followerTier?.label || "";
  document.querySelector("#check_basis").value = JSON.stringify({
    handle,
    basis: data.basis,
    notes: data.notes,
    industry: data.industry,
    screenshot: data.screenshot,
  });
}

function screenshotConfirmsHandle(handle, screenshot = screenshotAnalysis) {
  if (!screenshot.files || !screenshot.ready) return false;
  const expected = handle.toLowerCase();
  const detected = (screenshot.metrics?.accountHandle || "").replace(/^@+/, "").toLowerCase();
  if (detected && detected === expected) return true;

  const text = [
    screenshot.text,
    screenshot.metrics?.displayName,
    ...(screenshot.metrics?.bioMatches || []),
  ].filter(Boolean).join(" ").toLowerCase();
  if (!text) return false;

  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9._])@?${escaped}([^a-z0-9._]|$)`, "i").test(text);
}

function showResult(handle, data) {
  const status = {
    content: data.winner === "content" ? "優先檢查" : "次要檢查",
    positioning: data.winner === "positioning" ? "優先檢查" : "次要檢查",
    conversion: data.winner === "conversion" ? "優先檢查" : "次要檢查",
  };

  result.classList.add("is-ready");
  const evidenceBlock = data.screenshot.used
    ? `
      <div class="basis-box evidence-box">
        <b>這次納入的截圖依據</b>
        <p>這次會參考截圖中可見的首頁文字、粉絲數、貼文數、觀看數與行動引導；若截圖模糊或數字被遮住，部分資訊可能讀不到。</p>
        <ul class="signal-list">
          ${data.screenshot.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `
    : `
      <div class="basis-box evidence-box">
        <b>這次的判斷範圍</b>
        <p>本次尚未納入截圖，因此結果屬於快速初篩。若想讓判斷更貼近實際狀況，可以上傳帳號首頁、Reels 或貼文截圖後再檢測一次。</p>
      </div>
    `;

  result.innerHTML = `
    <p class="result-kicker">你的主要卡點</p>
    <h2>${escapeHtml(data.diagnosis)}</h2>
    <p>${escapeHtml(data.summary)}</p>
    <div class="account-chip">@${escapeHtml(handle)}</div>
    ${
      data.industry
        ? `<div class="account-chip industry-chip">行業：${escapeHtml(data.industry.label)}</div>`
        : ""
    }
    <div class="score-grid" aria-label="分類分數">
      <span>內容 <b>${status.content}</b></span>
      <span>定位 <b>${status.positioning}</b></span>
      <span>流量轉換 <b>${status.conversion}</b></span>
    </div>
    <div class="basis-box">
      <b>初步判斷依據與改善方向</b>
      <p>${escapeHtml(data.basis)}</p>
      <ul class="signal-list">
        ${data.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
    ${evidenceBlock}
    <div class="basis-box">
      <b>你可以先這樣改善</b>
      <ul class="signal-list">
        ${data.advice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;

  if (revealResultAnimation) revealResultAnimation();
}

async function runCheck() {
  if (screenshotAnalysis.loading) {
    ocrStatus.className = "ocr-status is-loading";
    ocrStatus.textContent = "截圖還在讀取中，請稍等幾秒再按一次檢測。";
    ocrStatus.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }

  const handle = parseInstagramInput(igUrlInput.value);
  if (!handle) {
    igUrlInput.setCustomValidity("請貼上完整 IG 帳號連結，例如 https://www.instagram.com/yourname/");
    igUrlInput.reportValidity();
    return null;
  }

  igUrlInput.setCustomValidity("");
  const screenshotHandleConfirmed = screenshotConfirmsHandle(handle, screenshotAnalysis);
  if (screenshotAnalysis.metrics?.accountHandle && screenshotAnalysis.metrics.accountHandle !== handle && !screenshotHandleConfirmed) {
    ocrStatus.className = "ocr-status is-error";
    ocrStatus.textContent = `帳號首頁截圖讀到的是 @${screenshotAnalysis.metrics.accountHandle}，和你貼上的 @${handle} 不一致，請重新上傳同一個帳號的首頁截圖。`;
    ocrStatus.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }

  let lookupResult = screenshotHandleConfirmed
    ? {
        success: true,
        exists: true,
        handle,
        source: "screenshot_match",
        snippet: `帳號首頁截圖已確認 @${handle}`,
      }
    : null;
  if (!lookupResult) {
  try {
    ocrStatus.className = "ocr-status is-loading";
    ocrStatus.textContent = `正在確認 @${handle} 是否有公開網頁搜尋結果...`;
    lookupResult = await lookupInstagramAccount(handle);
  } catch (error) {
    ocrStatus.className = "ocr-status is-error";
    ocrStatus.textContent = "目前無法確認這個 IG 帳號存在，請確認網址是否正確，或上傳清楚的帳號首頁截圖後再試。";
    ocrStatus.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }

  if (!lookupResult.exists) {
    ocrStatus.className = "ocr-status is-error";
    ocrStatus.textContent = `沒有搜尋到 @${handle} 的公開 IG 帳號結果，請確認網址是否正確。`;
    ocrStatus.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }
  }

  const verifiedScreenshot = {
    ...screenshotAnalysis,
    text: [
      screenshotAnalysis.text,
      lookupResult.snippet ? `網頁搜尋確認：${lookupResult.snippet}` : "",
    ].filter(Boolean).join("\n"),
  };
  if (!screenshotAnalysis.files) {
    ocrStatus.className = "ocr-status is-ready";
    ocrStatus.textContent = `已確認 @${handle} 有公開搜尋結果。若補上首頁、Reels、貼文截圖，結果會更貼近實際帳號狀況。`;
  }

  const data = analyzeHandle(handle, verifiedScreenshot);
  latestResult = { handle, data, lookup: lookupResult };
  fillHiddenFields(handle, data);
  if (playScanAnimation) {
    playScanAnimation(() => {
      showResult(handle, data);
      result.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  } else {
    showResult(handle, data);
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return latestResult;
}

previewBtn.addEventListener("click", runCheck);
screenshotInputs.forEach((input) => input.addEventListener("change", readScreenshots));

igUrlInput.addEventListener("input", () => {
  igUrlInput.setCustomValidity("");
  latestResult = null;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  runCheck();
});

window.addEventListener("DOMContentLoaded", initGsapAnimations);
