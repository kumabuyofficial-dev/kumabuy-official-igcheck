# Kumabuy Sites

這個 repo 放三個 Netlify 網站，之後用 GitHub 連動自動部署，不需要使用 Netlify AI Agent 點數。

## Netlify 設定

每個 Netlify site 都連到同一個 GitHub repo，差別只在 Base directory：

| 網站 | Base directory | Build command | Publish directory |
| --- | --- | --- | --- |
| kumabuy-brand.netlify.app | `brand` | 留空 | `.` |
| kumabuy-reels.netlify.app | `reels` | 留空 | `.` |
| kumabuy-official-igcheck-v4.netlify.app | `ig-check` | 留空 | `.` |

環境變數只放在 Netlify 後台，不要寫進 GitHub。
