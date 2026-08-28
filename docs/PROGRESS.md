# 施工进度

> 这份文件是给 Zachary 监督全程用的「总进度条」。
> 每完成一步就在这里打勾，不是写一次就扔掉。
> 铁律见根目录 `CLAUDE.md`，详细设计见 `docs/ARCHITECTURE.md`，
> Day 1 的具体命令见 `docs/DAY1.md`。

**更新规则**：每完成一步 → Zachary 验证通过 → 打勾 + 写完成日期。
计划有变（加功能、砍功能、调顺序）随时改这份文件，改了就是新计划。

---

## 开工前准备（Zachary 提供）

- [x] GitHub 私有仓库 `trip-fund`
- [x] Supabase 项目（Region: Southeast Asia (Singapore)）
- [x] Cloudflare 账号
- [x] 行程名称（Indonesia Family Trip）、钱包（IDR Cash 默认 / MYR Cash，MYR Bank 待加）

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
| 8 | 防休眠定时任务（GitHub Actions） | [x] | 2026-08-25 |

### 对应 PR

| PR | 分支 | 提交信息 | 步骤 | 状态 |
|---|---|---|---|---|
| #1 | `chore/scaffold` | `chore: scaffold vite react ts project` | 01–03 | [x] |
| #2 | `ci/cloudflare-pages` | `ci: deploy to cloudflare pages` | 04 | [x]（网页操作，非 git commit，已在 Cloudflare Dashboard 完成） |
| #3 | `feat/db-schema` | `feat: database schema and rls policies` | 05 | [x] |
| — | `fix/wrangler-config` | `fix: add wrangler.jsonc so Cloudflare branch builds can find the assets` | 补 04 | [x]（04 完成后才发现的坑，见下方备注） |
| #4 | `feat/auth` | `feat: magic link sign-in` | 06 | [x] |
| #5 | `feat/entries` | `feat: record entries and wallet balances` | 07 | [x] |
| #6 | `ci/keepalive` | `ci: keep supabase project awake` | 08 | [x]（加上排查用的 `fix/keepalive-logging`、`fix/keepalive-endpoint` 两个小 PR，见下方备注） |

---

## Day 2 —— 多钱包、收据、修改删除、实时同步、评论、Google 登录、PWA 安装引导

> 结束时的状态：装到主画面像 App，家人能实时看到。

- [x] 多钱包换汇记录（2026-08-27）—— AddEntry 加了"Move"模式，选两个钱包；
      币种相同是 transfer_out/in，不同是 fx_out/in（带汇率，自动预填上次用过的汇率）。
      两条记录用新函数 `create_transfer()` 一次性建好、互相关联（`paired_entry_id`
      改成了 deferrable 外键，不然两条互相引用谁先插都会报错）。
- [x] 收据拍照上传（2026-08-27）—— Storage bucket `receipts`（私有）连 policy 都用 SQL
      一次建好，不用去网页点。存储路径是 `<trip_id>/<entry_id>/文件名`，这样才能用
      `role_level()` 判断权限，跟其他表统一逻辑。图片私有，前端用"签名网址"（1 小时
      有效期）显示，不是公开链接。
- [x] 修改 / 删除（含回收站 + `entry_history` 自动留痕 + 变更记录 UI）（2026-08-27）
      —— 新增 `update_entry_fields()`/`soft_delete_entry()`/`restore_entry()` 三个函数，
      改动原因会存进 `entry_history.reason`；软删除/还原会连带处理换汇/转账的配对记录，
      不会留下半吊子的孤儿记录。点一笔账进 `EntryDetail.tsx` 能看完整历史时间线。
- [x] 实时同步（2026-08-27）—— entries/wallets/comments 三张表接了 Supabase Realtime，
      任何人改动，其他人打开的页面会自动刷新，不用手动 F5。
- [x] 每笔评论 / 提问（2026-08-27）—— 在 `EntryDetail.tsx` 里，member 也能发（这是
      member 唯一能写的地方），自己发的和 admin 都能删。
- [~] Google 登录（2026-08-27）—— 前端代码（Login 页的按钮、`signInWithGoogle()`）
      已经写好，摆在 Magic Link 上面（主推 Google，符合 ARCHITECTURE.md 的设计）。
      **还差 Zachary 去 Google Cloud Console 建 OAuth 应用、把 Client ID/Secret
      填进 Supabase 才能真的用**，这一步没法用代码代劳。
- [x] PWA 安装引导（2026-08-27）—— 加了 `InstallPrompt.tsx`：iOS 显示"用 Safari 加到
      主画面"的文字提示（iOS 没有自动弹窗这个 API），Android/桌面 Chrome 用系统自带的
      安装弹窗。顺手发现 PWA manifest 之前完全没配图标（装不成、Chrome 的安装按钮可能
      压根不出现），也补上了；同时把 `favicon.svg` 从 Vite 脚手架留下的紫色装饰图
      换成了一个简单的钱包图标，manifest 名字也从残留的中文改成了英文。
- [x] **邀请家人加入行程**（生成邀请链接/邀请码 → 家人登录后自动加进 `members` 表，角色 member）2026-08-26
      —— 之前漏写的一块：Day 2 结束要做到"家人能实时看到"，前提是家人得先能加入这本账，
      这个必须在 Day 2 完成，不能拖到 Day 3 的"成员管理"。
      顺手做了两件配套的事：① Home 页现在会按角色隐藏管理按钮（加钱包/记一笔/邀请
      对 member 不可见，之前这些按钮谁登录都看得到，member 点了只会撞到权限错误，
      体验很差）；② 加了 Avatar 组件（右上角一个圆圈，显示邮箱首字母，鼠标悬停看
      完整邮箱），方便同一台设备切换账号时确认"现在是谁登录"，Day 2 做 Google 登录后
      会自动变成真的 Google 头像，不用再改代码。
      **另外补一个漏做的功能（2026-08-28）**：做了邀请，却没做"看名单"——Home 页加了
      Members 入口（所有人可见），列出这本账现在有哪些人、各自什么角色，接了实时同步。
      **点邀请链接时提示已安装的家人改用主屏幕打开（2026-08-29）**——Zachary 问能不能
      点邀请链接时如果手机已经装了这个 App，直接跳去装好的那个 App，不要再开一次
      Safari/Chrome 的网页版。查证后是系统层面的硬限制：iOS 上一定会用 Safari 打开，
      不可能自动跳转到主屏幕上那个 App（没有原生 App 就没有这条路径，无解）；Android
      上如果是用 Chrome「加到主屏幕」装的，系统本身大概率会自动直接开已装的 App，
      不需要我们写代码。功能不受影响——因为同源，Safari 和主屏幕 App 共享登录状态，
      邀请照样能正常接受。做的是一个折中方案：接受邀请后，如果侦测到目前不是在独立
      全屏模式下打开（`display-mode: standalone` / iOS 的 `navigator.standalone`），
      顶部显示一条可关闭的提示，建议"已经装过的话下次直接从主屏幕打开"。顺手把这个
      判断逻辑从 `InstallPrompt.tsx` 抽成共用的 `src/lib/platform.ts`。

---

## Day 3 —— 离线记账、推送、成员管理、结算、导出

> 结束时的状态：没网也能记，家人手机会响，能一键结算。
> **风险提示（ARCHITECTURE.md §11）**：离线和推送最容易超时，卡住时优先保离线，推送用 Telegram 兜底。

- [x] 离线记账（2026-08-29）—— Expense 和 Contribution 断网也能记：判断
      `navigator.onLine`，没网时写进本地 IndexedDB 发件箱（不打网络请求），有网时照旧直接
      写库；回到有网（`online` 事件，或重新打开 App）自动用 upsert 补传，同一条用同一个
      UUID，补传失败/重复不会变成两笔。列表和余额里待补传的条目立刻显示（乐观更新），
      带「Pending sync」标签；余额上方有「N entries waiting to sync」提示。
      **有意缩小的范围**：Move/换汇（因为要连着两条一起写，重试更复杂）和收据照片
      （二进制文件放 IndexedDB 队列复杂度不成比例）这两样离线时不支持——没网时 Move
      按钮会被禁用，收据上传框会隐藏；照片可以等回到有网后再从这笔记录里补传。
      ARCHITECTURE.md §9 原本也想让照片进同一个队列，这次先不做，如果之后发现家人
      经常在断网时需要拍收据，再回来加。
- [ ] Web Push 通知（VAPID + Edge Function + 60 秒防抖 + 每晚汇总）
- [ ] Telegram Bot（第二通道，自动发每日汇总 + CSV 备份）
- [x] 成员管理（2026-08-29）—— Owner 能把 member 升级成 admin、把 admin 降回
      member、移除任何非 owner 的人；admin 只能移除 member 级别的人。数据库层面
      补了两道防线（步骤 5 当时漏掉的）：owner 这一行不能被删、owner 的角色不能
      被改成别的——不管是谁发起、透过什么方式，硬性挡住"这本账没了 owner"的情况。
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

**步骤 8 完成并验证**：`.github/workflows/keepalive.yml` 每 3 天自动 ping 一次，手动
触发（Run workflow）确认跑绿。排查过程中踩了一个坑：一开始 ping 的是 `/rest/v1/trips`
这张表，被 anon 零权限的设计（步骤 5 故意这样做）正常拦下来，报 "permission denied for
table trips"——这其实证明权限设计是对的，只是敲错了门。改成 ping Supabase 自己的
`/auth/v1/health` 健康检查接口，不涉及任何一张表的权限，问题解决。

**🎉 Day 1 全部 8 个步骤完成。** 现在能：登录（Magic Link）→ 建行程 → 加钱包 → 记一笔
→ 看余额和最近记录，数据全部存在 Supabase，刷新不丢。部署链路（push → Cloudflare 自动
构建发布）和数据库防休眠都已跑通。

下一步：Day 2——多钱包换汇、收据、修改删除与变更记录、实时同步、评论、Google 登录、
PWA 安装引导、邀请家人加入行程。

---

## Day 2 之后发现的补丁（2026-08-28 ~ 2026-08-29）

Day 2 名义上做完了，但实际测试（尤其是第一次真正打开手机、真正切到 Google 登录）又挖出
几个之前没发现的问题，一并记在这里：

- **Cloudflare 一直没配 Supabase 的环境变量**：`.env` 不上传 Git 是对的，但这也意味着
  Cloudflare 自己重新构建时读不到 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`，正式网址
  从很早（大概率是步骤 6 加了登录功能开始）就已经是坏的，只是没人真正打开过去检查
  ——之前的验证全部是在 `localhost` 的开发模式下做的。已经在 Cloudflare 的
  **Settings → Build → Variables and secrets** 补上，之后每次 push 都会自动带上。
- **登录跳转链接会越滚越大**：`emailRedirectTo`/`redirectTo` 用了 `window.location.href`，
  如果网址上还留着上一次失败登录的 `#access_token=...`，会被原样带进下一次的跳转目标，
  越滚越大直到解析不了。改成只取网址的"来源+路径+查询参数"，不带这个残留片段。
- **Google 登录会跳过选账号**：Google 记得设备上已经登过的账号，默认直接用那个，
  加了 `prompt=select_account` 强制每次跳出选择画面。
- **Avatar 图片没有失败保险**：Google 头像图片加载失败时只会显示浏览器默认的坏图标，
  加了失败退回字母圆圈的机制。
- **`contribution`（出资）没有记录"是谁给的"**：一直只有 Category/Note，但结算功能
  必须知道每个人各自出资多少。加了 `contributor_id`（指向已加入的成员）/
  `contributor_name`（那个人还没加入时先打字记着，之后能编辑改成真人）两个字段，
  数据库层面强制 contribution 记录必须有其中一个。
- **收据照片只能在记完账之后另外补传**：现在记一笔（Expense/Contribution）的时候
  就能直接选照片一起交上去，不用先存再回头找那笔账补传；相册/拍照都能选
  （之前限制成"只能拍照"，去掉了这个限制）。
- **Move（转账/换汇）和 Contribution 不该有"分类"**：分类对"钱从一个钱包搬去另一个"
  或者"谁给了钱"这两件事都没意义，两个模式下都把 Category 输入框去掉了。
- **PWA manifest 只有一个 SVG 图标，没有 PNG**：Android Chrome 的"安装"判定对图标格式
  比较挑，之前只给了 SVG，Chrome 有可能因此认定"不够格安装"（实测确认换成 Chrome 后能
  正常安装，Safari/非 Chrome 浏览器本来就不支持这个自动安装机制，属于预期内的限制）。
  补上了 192×192、512×512 的 PNG 图标（含 maskable 版本）和 iOS 用的
  apple-touch-icon，不然 iOS 加到主屏幕后图标会很难看。
- **装好的 App 不会自动更新到最新版本**：iPhone 上装好之后，改了代码重新部署，
  除非把 App 完全关掉重开（有时候要关两次）才会跟上最新版，之前只写了"检查有没有新
  版本"，没写"发现新版本就自动刷新"。改成 `main.tsx` 里自己接管 service worker 注册
  （`vite.config.ts` 设 `injectRegister: false`），一发现新版本就自动刷新页面，
  以后每次我们改完代码，家人手机上打开就是最新版，不用他们自己猜要不要关掉重开。

*最后更新：2026-08-29*
