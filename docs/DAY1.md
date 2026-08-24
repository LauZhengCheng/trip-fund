# Day 1 施工清单

> 目标：**Day 1 结束时，用手机打开一个网址，登进去，记下一笔支出，看到余额变了；
> 刷新页面它还在。而且这个网址家人现在就能打开。**

顺序是刻意排的：**先把「能上线」跑通，再填内容。**
这样部署问题在第一小时就暴露，而不是在最后一天。

---

## 开工前 Zachary 要准备的

| 项目 | 怎么弄 | 耗时 |
|---|---|---|
| GitHub 私有仓库 | 网页建一个空的 `trip-fund`，**不要勾任何初始化文件** | 2 分钟 |
| Supabase 账号 + 项目 | 用 GitHub 登录。**Region 选 Southeast Asia (Singapore)** | 5 分钟 |
| Cloudflare 账号 | 免费注册，不绑卡 | 3 分钟 |
| 行程基本资料 | 行程名称、成员名字、要开哪几个钱包 | 聊天里说 |

### 钱包建议这样开
| 钱包 | 币种 | 装什么 |
|---|---|---|
| MYR 银行 | `MYR` | 出发前收的公款、线上付的机票酒店 |
| MYR 现金 | `MYR` | 手上还没换的马币 |
| IDR 现金 | `IDR` | 换好的印尼盾，日常花的就是这个 |

钱包是数据不是写死的，到印尼要加「电子钱包」当场加。

### 不要贴进聊天的东西
Supabase 的 `service_role` key、数据库密码、任何账号密码。
只放本地 `.env`，并写进 `.gitignore`。
可以贴的：Project URL、`anon` key。

---

## 八个步骤

### 步骤 1 — 建项目骨架

```
cd C:\Users\lauzh\Projects\trip-fund
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js react-router-dom uuid
npm install tailwindcss @tailwindcss/vite
npm install -D vite-plugin-pwa
```

> 目录里已经有 `CLAUDE.md` 和 `docs/`，Vite 会提示目录非空，
> 选 **「Ignore files and continue」**。

**验证**：`npm run dev` → 浏览器 `localhost:5173` 看到 Vite 默认页面。
先别关，让它一直跑着。

---

### 步骤 2 — 配置项目文件

要写／改的文件：

```
.gitignore        # .env / node_modules / dist 不上传
README.md         # 项目说明、怎么跑、环境变量
vite.config.ts    # 加 Tailwind 插件 + PWA 插件
src/index.css     # 改成 @import "tailwindcss";
.env.example      # 环境变量样板（不含真实值）
.env              # 真实值，不上传
```

Tailwind v4 的配置方式（注意不是 v3 的 `tailwind.config.js`）：

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

```css
/* src/index.css */
@import "tailwindcss";
```

**验证**：浏览器画面还在，没报错。随便加一个 `class="text-red-500"` 看颜色有没有变。

---

### 步骤 3 — Git 初始化并推上 GitHub

先在 GitHub 网页建一个**私有**仓库 `trip-fund`，**不要勾任何初始化文件**。

```
git init
git branch -M main
git add .
git commit -m "chore: scaffold vite react ts project"
git remote add origin https://github.com/<用户名>/trip-fund.git
git push -u origin main
```

之后每个功能走 feature branch + PR，main 只接受合并进来的代码。

**验证**：GitHub 仓库页面看到代码，且 `node_modules` 和 `.env` **没有**被上传。

---

### 步骤 4 — 部署到 Cloudflare Pages

网页操作，不用命令行。
Workers & Pages → 建立应用程式 → Pages → 连接 GitHub → 选 `trip-fund`。

| 设定 | 值 |
|---|---|
| 框架预设 | `Vite` |
| 建置命令 | `npm run build` |
| 输出目录 | `dist` |

**验证**：拿到一个 `xxx.pages.dev` 网址，**用手机打开能看到页面**。
这一步通了，往后每次 push 都会自动更新。

---

### 步骤 5 — Supabase 建表

先建免费项目，**Region 选 Southeast Asia (Singapore)**。

写一个 `supabase/schema.sql`，Zachary 复制到 Supabase 的 SQL Editor 跑一次。内容：

```
trips · members · wallets · entries
entry_history · receipts · comments · push_subscriptions
+ role_level() 权限函数
+ RLS 策略
+ 自动写 entry_history 的触发器
```

详细字段见 `docs/ARCHITECTURE.md` §4、§5。

建好后把 **Project URL** 和 **anon key** 填进 `.env`。

**验证**：Table Editor 看到那 8 张表，每张右上角显示 `RLS enabled`。

---

### 步骤 6 — 登录功能（Magic Link）

**Day 1 先做 Magic Link**，它在 Supabase 里零配置。
Google 登录留到 Day 2（需要先去 Google Cloud Console 建 OAuth 应用，
步骤琐碎，容易在第一天卡住半小时）。

```
src/lib/supabase.ts     # 连接 Supabase
src/pages/Login.tsx     # 登录页
src/lib/auth.tsx        # 登录状态管理
```

**验证**：输入 Gmail → 去邮箱点链接 → 回到 App 看到「已登录：邮箱」。

---

### 步骤 7 — 记一笔 + 列表 + 余额

Day 1 的核心。

```
src/pages/Home.tsx           # 首页：各钱包余额
src/pages/AddEntry.tsx       # 记一笔的表单
src/components/EntryList.tsx
src/lib/money.ts             # 金额计算（整数运算）
src/lib/money.test.ts        # 唯一要写测试的地方
```

表单字段：金额、币种、钱包、分类、说明、时间。
**金额一律整数存**（MYR 存分，IDR 存整数盾）。

**验证**：记一笔 Rp 85,000 → 列表出现 → 首页 IDR 余额减少 85,000 →
**按 F5 刷新，数字还在**（证明真的进了数据库）。

---

### 步骤 8 — 防休眠定时任务

Supabase 免费项目闲置 7 天会被暂停。

```
.github/workflows/keepalive.yml   # 每 3 天 ping 一次
```

**验证**：GitHub Actions 页面手动 Run workflow 一次，看到绿色勾。

---

## PR 分组

| PR | 分支 | 提交信息 | 步骤 |
|---|---|---|---|
| #1 | `chore/scaffold` | `chore: scaffold vite react ts project` | 01–03 |
| #2 | `ci/cloudflare-pages` | `ci: deploy to cloudflare pages` | 04 |
| #3 | `feat/db-schema` | `feat: database schema and rls policies` | 05 |
| #4 | `feat/auth` | `feat: magic link sign-in` | 06 |
| #5 | `feat/entries` | `feat: record entries and wallet balances` | 07 |
| #6 | `ci/keepalive` | `ci: keep supabase project awake` | 08 |

流程：写完 → Zachary 在浏览器验证 → 他说「可以」→ commit & push → 开 PR →
他看 diff → 合并。

---

## 最可能卡住的地方

| 症状 | 原因与解法 |
|---|---|
| Cloudflare 构建失败 | 八成是 Node 版本或输出目录填错。看构建日志。**这就是为什么部署排第 4 步而不是最后** |
| Magic Link 收不到信 | 先翻垃圾邮件。Supabase 免费方案邮件有频率限制，测试时别连点 |
| 登录成功但列表空的 / 存不进去 | RLS 挡住了自己。最常见的新手坑，要教 Zachary 怎么在 Supabase 后台排查 |
| npm 装不上 | Windows 权限。用管理员身份开 PowerShell 再试 |

这些都是十分钟内能解决的。**看到红色报错是正常的开发过程，不是出事了**——
要跟 Zachary 讲清楚这点，他是第一次做这种项目。
