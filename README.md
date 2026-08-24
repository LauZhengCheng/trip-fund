# 印尼行程公款账本（Trip Fund Ledger）

家庭旅行公款记账用的 PWA。Zachary 作为财政记账，家人只读 + 可评论。

项目背景、设计约定、施工进度分别见：
- [`CLAUDE.md`](./CLAUDE.md) —— 项目铁律，动手前必读
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) —— 详细设计
- [`docs/DAY1.md`](./docs/DAY1.md) —— Day 1 施工步骤
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) —— 总进度条

## 技术栈

Vite + React + TypeScript + Tailwind CSS v4 + vite-plugin-pwa，后端用 Supabase
（Postgres / Auth / Storage / Realtime / Edge Functions），部署在 Cloudflare Pages。

## 本地开发

```
npm install
npm run dev
```

打开 `http://localhost:5173`。

## 环境变量

复制 `.env.example` 为 `.env`，填入 Supabase 项目的 Project URL 和 anon key
（Project Settings > API 里能找到）。`.env` 已加进 `.gitignore`，不会被提交。

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**绝不把 `service_role` key、数据库密码贴进这个仓库或任何聊天记录。**
