# 施工进度

> 这份文件是给 Zachary 监督全程用的「总进度条」。
> 每完成一步就在这里打勾，不是写一次就扔掉。
> 铁律见根目录 `CLAUDE.md`，详细设计见 `docs/ARCHITECTURE.md`，
> Day 1 的具体命令见 `docs/DAY1.md`。

**更新规则**：每完成一步 → Zachary 验证通过 → 打勾 + 写完成日期。
计划有变（加功能、砍功能、调顺序）随时改这份文件，改了就是新计划。

---

## 开工前准备（Zachary 提供）

- [ ] GitHub 私有仓库 `trip-fund`（空的，不勾初始化文件）
- [ ] Supabase 项目（Region: Southeast Asia (Singapore)）
- [ ] Cloudflare 账号
- [ ] 行程名称、成员名字、要开哪几个钱包

---

## Day 1 —— 骨架、部署、数据库、登录、记账、余额

> 结束时的状态：能记账，家人能打开网址。

| # | 步骤 | 状态 | 完成日期 |
|---|---|---|---|
| 1 | 建项目骨架（Vite + React + TS + 依赖） | [x] | 2026-08-24 |
| 2 | 配置项目文件（Tailwind v4、PWA 插件、.env、.gitignore） | [x] | 2026-08-24 |
| 3 | Git 初始化并推上 GitHub | [x] | 2026-08-24 |
| 4 | 部署到 Cloudflare Pages | [x] | 2026-08-24 |
| 5 | Supabase 建表（8 张表 + RLS + role_level()） | [x] | 2026-08-24 |
| 6 | 登录功能（Magic Link） | [ ] | |
| 7 | 记一笔 + 列表 + 余额 | [ ] | |
| 8 | 防休眠定时任务（GitHub Actions） | [ ] | |

### 对应 PR

| PR | 分支 | 提交信息 | 步骤 | 状态 |
|---|---|---|---|---|
| #1 | `chore/scaffold` | `chore: scaffold vite react ts project` | 01–03 | [x] |
| #2 | `ci/cloudflare-pages` | `ci: deploy to cloudflare pages` | 04 | [x]（网页操作，非 git commit，已在 Cloudflare Dashboard 完成） |
| #3 | `feat/db-schema` | `feat: database schema and rls policies` | 05 | [ ] |
| #4 | `feat/auth` | `feat: magic link sign-in` | 06 | [ ] |
| #5 | `feat/entries` | `feat: record entries and wallet balances` | 07 | [ ] |
| #6 | `ci/keepalive` | `ci: keep supabase project awake` | 08 | [ ] |

---

## Day 2 —— 多钱包、收据、修改删除、实时同步、评论、Google 登录、PWA 安装引导

> 结束时的状态：装到主画面像 App，家人能实时看到。

- [ ] 多钱包换汇记录（MYR 银行 / MYR 现金 / IDR 现金分开算，换汇实现汇率自动算出）
- [ ] 收据拍照上传（Supabase Storage）
- [ ] 修改 / 删除（含回收站 + `entry_history` 自动留痕 + 变更记录 UI）
- [ ] 实时同步（Supabase Realtime）
- [ ] 每笔评论 / 提问
- [ ] Google 登录（先去 Google Cloud Console 建 OAuth 应用）
- [ ] PWA 安装引导（提示「加到主画面」，注明必须用 Safari）

---

## Day 3 —— 离线记账、推送、成员管理、结算、导出

> 结束时的状态：没网也能记，家人手机会响，能一键结算。
> **风险提示（ARCHITECTURE.md §11）**：离线和推送最容易超时，卡住时优先保离线，推送用 Telegram 兜底。

- [ ] 离线记账（客户端生成 UUID、IndexedDB 本地发件箱、幂等 upsert、待同步状态图标）
- [ ] Web Push 通知（VAPID + Edge Function + 60 秒防抖 + 每晚汇总）
- [ ] Telegram Bot（第二通道，自动发每日汇总 + CSV 备份）
- [ ] 成员管理（Owner 任免 Admin / 移除 Member）
- [ ] 结算表（该退你多少 = 你交了多少 − 总消费 ÷ 人数）
- [ ] 导出 CSV

---

## 出发前必做（不能省）

- [ ] 全家聚一次，当场帮每个人用 **Safari** 打开网址并「加到主画面」
- [ ] 帮每个人登录（Google 或 Magic Link）
- [ ] 开通知权限
- [ ] 现场记一笔，确认每个人手机都响了
- [ ] 飞行模式实测离线记账 → 联网后确认自动补传

---

## 候补名单（时间不够就砍，不硬塞）

- 分类与统计
- 非均分支出（默认规则：不是全员共享的消费不走公款）
- 预算提醒
- 已读标记
- OCR 自动识别金额（明确不做）
- 银行 / 电子钱包对接（明确不做）

---

## 当前状态

**步骤 4 完成并验证**：网址 `trip-fund.lauzhengcheng.workers.dev`，手机浏览器打开确认能看到页面。
注意（供以后排查参考）：
- Cloudflare 改版后旧版 DAY1.md 里「Pages → 建立应用程式」路径已不存在，实际走 Compute → Workers & Pages → Create application → 连 Git 仓库，效果等价。
- 新版 Workers 部署后默认**不会**开放公网访问，要手动去 Domains 分页把 Production 那一行的 `workers.dev` 开关打开，否则显示 "No URLs enabled"。
下一步：Day 1 步骤 5，Supabase 建表。

*最后更新：2026-08-24*
