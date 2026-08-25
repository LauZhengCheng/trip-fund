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
| 6 | 登录功能（Magic Link） | [x] | 2026-08-24 |
| 7 | 记一笔 + 列表 + 余额 | [x] | 2026-08-25 |
| 8 | 防休眠定时任务（GitHub Actions） | [ ] | |

### 对应 PR

| PR | 分支 | 提交信息 | 步骤 | 状态 |
|---|---|---|---|---|
| #1 | `chore/scaffold` | `chore: scaffold vite react ts project` | 01–03 | [x] |
| #2 | `ci/cloudflare-pages` | `ci: deploy to cloudflare pages` | 04 | [x]（网页操作，非 git commit，已在 Cloudflare Dashboard 完成） |
| #3 | `feat/db-schema` | `feat: database schema and rls policies` | 05 | [x] |
| — | `fix/wrangler-config` | `fix: add wrangler.jsonc so Cloudflare branch builds can find the assets` | 补 04 | [x]（04 完成后才发现的坑，见下方备注） |
| #4 | `feat/auth` | `feat: magic link sign-in` | 06 | [x] |
| #5 | `feat/entries` | `feat: record entries and wallet balances` | 07 | [x] |
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
- [ ] **邀请家人加入行程**（生成邀请链接/邀请码 → 家人登录后自动加进 `members` 表，角色 member）
      —— 之前漏写的一块：Day 2 结束要做到"家人能实时看到"，前提是家人得先能加入这本账，
      这个必须在 Day 2 完成，不能拖到 Day 3 的"成员管理"

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

**步骤 5 完成并合并**：`supabase/schema.sql` 已在 Supabase 跑通（8 张表 + RLS），
PR #1 和补充的 `fix/wrangler-config` 都已合并进 `main`，本地已同步。

注意（供以后排查参考）：
- Cloudflare 改版后旧版 DAY1.md 里「Pages → 建立应用程式」路径已不存在，实际走 Compute → Workers & Pages → Create application → 连 Git 仓库，效果等价。
- 新版 Workers 部署后默认**不会**开放公网访问，要手动去 Domains 分页把 Production 那一行的 `workers.dev` 开关打开，否则显示 "No URLs enabled"。
- **PR/分支的预览构建需要仓库里有 `wrangler.jsonc`**（写明 `assets.directory`），
  网页精灵建的第一次生产部署不需要这个文件也能跑，但那是因为设置藏在 Cloudflare
  项目配置里，不在代码里——分支预览构建读不到那份设置，会报
  "Missing entry-point to Worker script or to assets directory"。已经修好，
  以后新分支的 PR 都会正常构建。

**步骤 6 完成并验证**：Magic Link 登录跑通——发信、点链接登录、F5 刷新仍保持登录状态。
顺手清理了 Vite 脚手架留下的没用文件（`App.css`、示意图、旧图标），网页标题也从
遗留的 `vite-scaffold-tripfund` 改成了 `Trip Fund`。

**步骤 7 完成并验证**：Day 1 核心功能全部跑通——建行程（TripList）→ 加钱包（Home 里的
Add wallet）→ 记一笔（AddEntry）→ 首页按钱包切换看余额和最近记录（EntryList），
刷新页面数据都还在（数据在 Supabase，不是本地假数据）。

排查过程中发现并修了两个问题：
- `trips_read` 权限规则原本只看"你是不是这本账的成员"，但"建账自动变成员"是触发器做的，
  跟"建完账马上要把这本账读回来显示"这两件事在极少数情况下会打架，导致新建的账被
  连本带利撤销，报 "new row violates row-level security policy"。修法：这条规则加一句
  "或者你就是创建者"，创建者不用等触发器也能看到自己刚建的账。
- 加钱包/记一笔的表单一开始只用占位文字（输入框内的灰字提示），一旦开始打字提示就消失，
  完全看不出"这一栏该填什么"。改成每个字段上方都有固定不消失的标签。

还发现一个漏在计划外的功能缺口：现在只有"建账的人"能用，家人没有办法自己加入这本账——
已经补进 Day 2 清单（"邀请家人加入行程"），Day 2 结束前必须做完，
不然"家人能实时看到"这个 Day 2 目标根本无从谈起。

下一步：Day 1 步骤 8，防休眠定时任务（GitHub Actions）。

*最后更新：2026-08-25*
