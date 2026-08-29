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

## Web Push（推送通知）

新增记账、每晚汇总会推到家人手机。数据库那边（`pg_cron` 每分钟检查一次、
`pg_net` 发 HTTP 请求）跟发送那边（Supabase Edge Function，实际做 VAPID 签名、
真正把推送送出去）是分开的两块，各自要设置一次：

1. **生成 VAPID 密钥对**（一次性，本地跑就行，不需要任何账号）：
   ```
   npx web-push generate-vapid-keys --json
   ```
   公钥填进 `.env` 的 `VITE_VAPID_PUBLIC_KEY`；私钥填 `VAPID_PRIVATE_KEY`
   （只用在下面第 3 步，不能加 `VITE_` 前缀，绝不能进 git）。

2. **在 Supabase SQL Editor 跑 `supabase/schema.sql` 里「Web Push」那一节**，
   然后单独把这两行的占位符换成真实值再跑一次（`.env` 里能找到）：
   ```sql
   select vault.create_secret('https://你的项目.supabase.co', 'supabase_url');
   select vault.create_secret('.env 里的 PUSH_CRON_SECRET', 'push_cron_secret');
   ```
   （最初想用 `alter database ... set app.settings.xxx` 存这两个值，但 Supabase
   托管数据库不给 SQL Editor 的 postgres 角色改数据库级别参数的权限，改用
   Supabase 自带的 Vault。）

3. **部署 Edge Function**（需要 Supabase CLI，本地终端跑）：
   ```
   npx supabase login
   npx supabase link --project-ref 你的项目ref
   npx supabase functions deploy send-push --no-verify-jwt
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... PUSH_CRON_SECRET=... PUSH_CONTACT_EMAIL=你的邮箱
   ```
   四个值都从 `.env` 里复制，`PUSH_CONTACT_EMAIL` 是 VAPID 协议要求的联系方式
   （推送服务如果发现滥用，会用这个邮箱联系发送方，不会给用户看到）。

4. 家人打开 App，Home 页余额下面点「Turn on notifications」授权。
   **iOS 必须先「加到主屏幕」再点这个按钮**——不是从 Safari 分页里，iOS 只有
   装成主屏幕图标的 PWA 才能用推送，这是系统限制，App 内会自动判断并提示。
