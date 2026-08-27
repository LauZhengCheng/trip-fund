# 项目：印尼行程公款账本（Trip Fund Ledger）

> 这是项目的长期记忆。**每次动手前先读它。**
> 详细设计见 `docs/ARCHITECTURE.md`，当前施工步骤见 `docs/DAY1.md`，
> 总进度条（Zachary 监督用）见 `docs/PROGRESS.md`。
> Zachary 随时可以往里加条款；加了就等于生效。

---

## 一、项目铁律（不可违反，任何方案先过这四条）

1. **零成本。** 不付订阅、不付开发者账号、不买域名、不绑信用卡。
   任何需要花钱的方案直接出局，不进入讨论，也不要作为「更好的选择」提出来。
   - 已因此否决：Apple Developer Program（US$99/年）、原生 iOS App、
     Supabase Pro、手机号 OTP 登录、WhatsApp 官方 API、Google Play 开发者账号。

2. **管理员拥有完整权限。** Zachary 作为 admin 可以新增、修改、删除任何记录。
   不设技术限制。Member 是「只读 + 可评论」。
   - 修改和删除要留痕（`entry_history` 表 + 回收站），但那是为了方便他回答家人的
     提问，**不是用来限制他的**。

3. **逐步确认，但不用逐步验证。**（2026-08-27 调整）大方向 / 有分歧的设计决策，
   动手前还是要先说清楚、等他点头。但**不需要每完成一个功能就停下来叫他打开浏览器测试**——
   可以连续往下做完好几个功能，Claude 自己用 build/test（`npm run build`、`npm run test`）
   保证代码能编译、逻辑正确。只有在**卡到必须他本人操作**的地方才停下来找他：
   - 要去 Supabase SQL Editor 跑新的 SQL
   - 要去 Google Cloud Console / 别的外部平台建东西、拿密钥
   - 遇到一个 Claude 没法替他决定的设计判断
   大头做完之后，再一次性给他完整测一遍，而不是每一步都要验证一次。
   - 看不懂的地方要停下来解释。**看懂比做完重要**——这条不变，讲解照旧要做。

4. **两到三天做完核心。** 撑不进这个窗口的功能进候补名单，不硬塞。

---

## 二、沟通方式

- **用中文（简体）沟通。** Zachary 是马来西亚华人。
- **但 App 本身的界面语言用英文。** 中文只用于 Zachary 和 Claude 之间的讨论；
  代码里所有 UI 文字、按钮、标签、分类名称等一律写英文（2026-08-24 确认）。
- 术语第一次出现时用一句话解释，不要假设他知道。
- 他提出异议时认真对待——他比你了解他家人怎么用这个东西。
  （已发生过一次：他推翻了「admin 不能改历史」的设计，他是对的。）

---

## 三、技术栈（已定，全部免费）

| 层 | 选择 |
|---|---|
| 前端 | Vite + React + TypeScript |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite` 插件） |
| PWA | `vite-plugin-pwa`（Service Worker + manifest） |
| 后端 | Supabase Free（Postgres / Auth / Storage / Realtime / Edge Functions） |
| 推送 | Web Push (VAPID) + Supabase Edge Function；Telegram Bot 作第二通道 |
| 托管 | Cloudflare Pages（免费子域名，不买域名） |
| 代码 | GitHub 私有仓库 |
| 防休眠 | GitHub Actions 定时任务，每 3 天 ping 一次 Supabase |

**形态是 PWA，不是原生 App。** 原因：iOS 上不存在免费的分发路径
（Apple Developer Program US$99/年无法绕过），而 PWA 是零成本前提下唯一能
同时覆盖 iOS 和 Android 且支持推送的方案。

---

## 四、角色模型

| 角色 | 权限 | 来源 |
|---|---|---|
| **Owner** | 全部 + 任免 Admin + 改成员角色 + 删除整本账 | 创建行程者，不可被移除 |
| **Admin** | 记账、改、删、邀请与移除 Member（动不了 Owner） | 由 Owner 提升 |
| **Member** | 只读 + 评论提问 | 受邀加入的默认角色 |

- 权限判断集中在一个 `role_level()` 函数里，用数字比大小
  （owner=3 > admin=2 > member=1）。**要加角色或调权限，只改这一个地方。**
- 多 Admin 的离线冲突：采用「后写覆盖 + 全程留痕」，不引入冲突合并机制。

---

## 五、不可动摇的技术约定

- **金额一律用整数存**（minor units）。**禁止浮点数。**
  每个币种带 `exponent`：MYR = 2（RM 12.50 → `1250`），**IDR = 0**（Rp 85,000 → `85000`）。

- **汇率：每笔各自记录、随时可改、系统绝不自动覆盖。**
  - ✅ 每一笔换汇／出资都有自己的汇率输入框，可预填参考值，可随时编辑，改动进 log。
  - ❌ 禁止「系统去查市场汇率，然后拿它批量重算历史记录」——那会让余额天天飘。
  - 不同成员在不同时间换汇、汇率各不相同，是**必须支持的正常场景**，不是例外。

- **多钱包模型**：MYR 银行 / MYR 现金 / IDR 现金分开算余额，首页不显示混合总数。
  钱包是数据，可随时增删，不写死。

- **客户端生成 UUID 作主键** + upsert 幂等，避免离线重发造成重复记账。

- **结算公式**：`该退你多少 = 你交了多少 − 总消费 ÷ 人数`。
  出资相同时自动退化成「剩余平分」。**人数不写死，任意 N 都要支持。**

- **改动历史对所有成员公开**：每笔账点进去能看完整变更记录（谁、何时、改了什么、原因）。

- **不做**：非均分支出、OCR、银行对接。

### 设计原则：不要锁死
Zachary 明确要求过——规则要留调整空间。凡是「以后可能会变」的东西
（角色权限、汇率、分类、钱包种类、通知规则），都要做成**可配置的数据，
或集中在一个函数里**，不要硬编码散落各处。宁可多留一个可编辑字段，也不要事后大改。

---

## 六、Git 规范（Zachary 明确要求，必须执行）

**每完成一个 feature 并经他验证通过，立刻 commit + push。不要攒着。**

- 提交信息用 Conventional Commits：`feat:` `fix:` `refactor:` `docs:` `chore:` `ci:`
- 一个 feature 一组提交；不把多个功能塞进一个 commit
- **分支策略：feature branch + PR**（已确认，不直接推 main）
  - 开分支 → 做完 → 开 PR → Zachary 看 diff → 合并
  - PR 的 diff 界面是他审查改动的主要工具
- `README.md` 随功能同步更新：项目是什么、怎么跑、有哪些环境变量
- `.gitignore` 第一天配好：`.env`、`node_modules`、`dist` 一律不上传

---

## 七、测试策略

只给**算钱的部分**写单元测试：余额计算、换汇、结算。
理由：这些错了不容易一眼看出来。UI 手点验证就够，写测试反而浪费时间。

---

## 八、安全约定

- **绝不把密钥贴进聊天。** `service_role` key、数据库密码、任何登录密码
  只放本地 `.env`，并写进 `.gitignore`。
- Supabase `anon` key 可以出现在前端代码里（设计如此，由 RLS 保护）。

---

## 九、环境

- **项目路径**：`C:\Users\lauzh\Projects\trip-fund`
- **系统**：Windows
- Zachary 那边三个窗口：VS Code（看代码）、终端（`npm run dev`）、浏览器（`localhost:5173`）
- 部署：push 到 GitHub → Cloudflare Pages 自动构建发布

---

## 十、进度追踪

### 已确认
- [x] 形态：PWA（不做原生 App）
- [x] 家人 iPhone 全部 iOS 16.4 以上 → Web Push 可用
- [x] 家人都有 Gmail → 登录主推 Google，Magic Link 作备选
- [x] 全家在用 Telegram → Web Push + Telegram 双通道
      （Telegram Bot 兼任每日汇总与 CSV 账本的自动投递）
- [x] 三级角色 Owner / Admin / Member，Owner 可任免
- [x] 改动历史对所有成员公开
- [x] 汇率每笔各自记录、可编辑、不自动覆盖
- [x] 出资目前每人相同，但按通用公式实现；人数不写死
- [x] Git：feature branch + PR，每个 feature 完成就 push
- [x] 项目路径 `C:\Users\lauzh\Projects\trip-fund`

### 待 Zachary 提供
- [ ] GitHub 私有仓库 `trip-fund`（空的，不勾任何初始化文件）
- [ ] Supabase 项目 URL + anon key（Region 选 Singapore）
- [ ] Cloudflare 账号
- [ ] 行程名称、成员名字、要开哪几个钱包

### 当前进度
**尚未开始实作。** 下一步是 `docs/DAY1.md` 的步骤 1。

---

*最后更新：2026-08-24*
