# Kumabuy IG Check

免費 IG 帳號檢測器，部署於 Netlify。

## Deploy

Netlify 設定：

- Build command: 留空
- Publish directory: `.`
- Functions directory: `netlify/functions`

## Environment Variables

請在 Netlify 後台設定，不要寫入 GitHub：

- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `LINE_URL`
- `META_INSTAGRAM_APP_ID`
- `META_INSTAGRAM_APP_SECRET`
- `META_INSTAGRAM_REDIRECT_URI`

## Notes

- `.netlify/` 是本機連線狀態，不需要上傳 GitHub。
- `.env.example` 只保留欄位名稱，不放真正 API Key。
