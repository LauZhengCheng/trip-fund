-- 印尼行程公款账本 · 数据库结构
-- 复制这整份文件到 Supabase SQL Editor 跑一次。
-- 设计依据见 docs/ARCHITECTURE.md §4/§5/§6，铁律见根目录 CLAUDE.md。

-- ============================================================
-- 1. trips —— 一次行程 = 一本账
-- ============================================================
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'MYR',
  start_date date,
  end_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table trips enable row level security;

-- ============================================================
-- 2. members —— 成员与角色
-- ============================================================
create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table members enable row level security;

-- ============================================================
-- role_level() —— 所有权限判断集中在这一个函数
-- SECURITY DEFINER：绕开 RLS 直接查 members 表，
-- 否则会出现"要检查权限，但检查权限本身又被权限挡住"的死循环。
-- ============================================================
create or replace function role_level(p_trip_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case role
       when 'owner' then 3
       when 'admin' then 2
       when 'member' then 1
     end
     from members
     where trip_id = p_trip_id and user_id = auth.uid()),
    0
  );
$$;

-- ============================================================
-- 建账本自动变成 owner
-- 解决"还不是任何人的成员时，怎么证明有权限"的先有鸡先有蛋问题。
-- ============================================================
create or replace function handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into members (trip_id, user_id, display_name, role)
  values (new.id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Trip Creator'), 'owner');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on trips
  for each row execute function handle_new_trip();

-- ============================================================
-- 3. wallets —— 钱放在哪里
-- 不做硬删除：archived_at 非空代表"隐藏但保留数据"，
-- 因为已有历史记录指向这个钱包时，真删会破坏账本完整性。
-- is_default：首页默认显示哪个钱包（比如这趟去印尼默认显示 IDR 现金），
-- 不写死在代码里，因为下次旅行主要花的货币可能不一样。
-- ============================================================
create table wallets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,
  currency text not null,
  exponent int not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- 一个 trip 最多只能有一个默认钱包（部分唯一索引，只约束 is_default = true 的行）
create unique index wallets_one_default_per_trip
  on wallets (trip_id)
  where is_default;

alter table wallets enable row level security;

-- ============================================================
-- 4. entries —— 账本流水本体
-- id 由客户端生成 UUID（离线记账用），删除是软删除（deleted_at）。
-- paired_entry_id：换汇/转账的两条腿互相关联，方便点开一笔看到对面那笔。
-- ============================================================
create table entries (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  wallet_id uuid not null references wallets(id),
  type text not null check (type in (
    'contribution', 'expense', 'fx_out', 'fx_in',
    'transfer_out', 'transfer_in', 'reimbursement', 'refund', 'settlement'
  )),
  -- amount_minor 一律存正数（金额大小），加还是减完全由 type 决定，
  -- 见 src/lib/money.ts 的 POSITIVE_TYPES——这是唯一判断正负号的地方。
  amount_minor bigint not null check (amount_minor >= 0),
  fx_rate numeric,
  category text,
  note text,
  -- 出资（contribution）要记"是谁给的"，才能算结算（每个人一共出了多少）。
  -- 两种存法都留：contributor_id 指向一个真正的 member（优先，能可靠地按人加总）；
  -- 那个人还没加入这本账时，先用 contributor_name 打字记着，等他真的加入了，
  -- 编辑这笔账把 contributor_id 换成真人、contributor_name 清空即可。
  contributor_id uuid references members(id),
  contributor_name text,
  occurred_at timestamptz not null default now(),
  -- deferrable：换汇/转账两条腿互相引用对方的 id，两条都插完才检查这个约束，
  -- 不然谁先插谁就会因为"对方还不存在"报错（先有鸡先有蛋）。
  paired_entry_id uuid references entries(id) deferrable initially deferred,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint entries_contribution_has_contributor
    check (type <> 'contribution' or contributor_id is not null or contributor_name is not null)
);

alter table entries enable row level security;

-- ============================================================
-- 5. entry_history —— 修改/删除留痕（触发器自动写，任何人都不能直接写）
-- 只给 SELECT policy，不给 INSERT/UPDATE/DELETE policy：
-- 这样即使是 bug 也没有路径能绕过触发器直接篡改历史。
-- ============================================================
create table entry_history (
  id uuid primary key default gen_random_uuid(),
  -- 故意不写 on delete cascade：entries 一律软删除（改 deleted_at），
  -- 万一有人想直接硬删 entries，让外键约束直接报错拦住，而不是安静地连历史一起抹掉。
  entry_id uuid not null references entries(id),
  trip_id uuid not null references trips(id) on delete cascade,
  action text not null check (action in ('insert', 'update', 'delete', 'restore')),
  before jsonb,
  after jsonb,
  reason text,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table entry_history enable row level security;

-- reason 从 trip_fund.edit_reason 这个"当前事务局部变量"里读——
-- 三个 update_entry_fields/soft_delete_entry/restore_entry 函数会在真正
-- update 之前先把这次的理由塞进这个变量，触发器读到了就存下来。
-- 直接对 entries 做 update（不走这三个函数）也完全能用，只是 reason 会是空的。
create or replace function log_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into entry_history (entry_id, trip_id, action, before, after, changed_by)
    values (new.id, new.trip_id, 'insert', null, to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into entry_history (entry_id, trip_id, action, before, after, reason, changed_by)
    values (
      new.id, new.trip_id,
      case when new.deleted_at is not null and old.deleted_at is null then 'delete'
           when new.deleted_at is null and old.deleted_at is not null then 'restore'
           else 'update' end,
      to_jsonb(old), to_jsonb(new),
      nullif(current_setting('trip_fund.edit_reason', true), ''),
      auth.uid()
    );
    return new;
  end if;
  return null;
end;
$$;

create trigger on_entry_change
  after insert or update on entries
  for each row execute function log_entry_change();

-- ============================================================
-- 改一笔 / 软删除 / 还原 —— 都不用 SECURITY DEFINER，
-- 就用调用者本人的权限跑那句 update，所以还是要过 entries_update 那条 RLS 规则，
-- 不会因为多了这几个函数就让权限变松。
-- 这三个函数存在的唯一理由：把"这次为什么改"这句话，跟真正的 update 打包在
-- 同一个事务里一起做，好让触发器读到、存进 entry_history.reason。
-- ============================================================
-- 签名变了（多了 contributor 两个参数），旧版本得先删掉再建新的——
-- Postgres 的 create or replace 不允许直接改参数列表。
drop function if exists update_entry_fields(uuid, bigint, text, text, timestamptz, text);

create or replace function update_entry_fields(
  p_entry_id uuid,
  p_amount_minor bigint,
  p_category text,
  p_note text,
  p_occurred_at timestamptz,
  p_contributor_id uuid default null,
  p_contributor_name text default null,
  p_reason text default null
)
returns entries
language plpgsql
set search_path = public
as $$
declare
  v_entry entries;
begin
  perform set_config('trip_fund.edit_reason', coalesce(p_reason, ''), true);

  update entries
  set amount_minor = p_amount_minor,
      category = p_category,
      note = p_note,
      occurred_at = p_occurred_at,
      contributor_id = p_contributor_id,
      contributor_name = p_contributor_name,
      updated_at = now()
  where id = p_entry_id
  returning * into v_entry;

  if not found then
    raise exception 'Entry not found, or you do not have permission to edit it';
  end if;

  return v_entry;
end;
$$;

-- 软删除/还原会连带处理配对的那一条（换汇/转账两条腿是同一件事，
-- 只删一条会留下算不对账的孤儿记录）。
create or replace function soft_delete_entry(p_entry_id uuid, p_reason text default null)
returns entries
language plpgsql
set search_path = public
as $$
declare
  v_entry entries;
begin
  perform set_config('trip_fund.edit_reason', coalesce(p_reason, ''), true);

  update entries
  set deleted_at = now()
  where id = p_entry_id
  returning * into v_entry;

  if not found then
    raise exception 'Entry not found, or you do not have permission to delete it';
  end if;

  if v_entry.paired_entry_id is not null then
    update entries
    set deleted_at = now()
    where id = v_entry.paired_entry_id and deleted_at is null;
  end if;

  return v_entry;
end;
$$;

create or replace function restore_entry(p_entry_id uuid, p_reason text default null)
returns entries
language plpgsql
set search_path = public
as $$
declare
  v_entry entries;
begin
  perform set_config('trip_fund.edit_reason', coalesce(p_reason, ''), true);

  update entries
  set deleted_at = null
  where id = p_entry_id
  returning * into v_entry;

  if not found then
    raise exception 'Entry not found, or you do not have permission to restore it';
  end if;

  if v_entry.paired_entry_id is not null then
    update entries
    set deleted_at = null
    where id = v_entry.paired_entry_id and deleted_at is not null;
  end if;

  return v_entry;
end;
$$;

-- ============================================================
-- create_transfer() —— 换汇 / 同币种转账，一次性建两条互相关联的记录
-- p_from_type/p_to_type 由前端决定传 'transfer_out'/'transfer_in'（同币种）
-- 还是 'fx_out'/'fx_in'（换汇，带 fx_rate）。两条一起插，靠上面那个
-- deferrable 约束才能互相引用对方的 id。
-- ============================================================
create or replace function create_transfer(
  p_trip_id uuid,
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_from_amount_minor bigint,
  p_to_amount_minor bigint,
  p_from_type text,
  p_to_type text,
  p_fx_rate numeric,
  p_category text,
  p_note text,
  p_occurred_at timestamptz
)
returns table(out_id uuid, in_id uuid)
language plpgsql
set search_path = public
as $$
declare
  v_out_id uuid := gen_random_uuid();
  v_in_id uuid := gen_random_uuid();
begin
  insert into entries
    (id, trip_id, wallet_id, type, amount_minor, fx_rate, category, note, occurred_at, paired_entry_id, created_by)
  values
    (v_out_id, p_trip_id, p_from_wallet_id, p_from_type, p_from_amount_minor, p_fx_rate, p_category, p_note, p_occurred_at, v_in_id, auth.uid()),
    (v_in_id, p_trip_id, p_to_wallet_id, p_to_type, p_to_amount_minor, p_fx_rate, p_category, p_note, p_occurred_at, v_out_id, auth.uid());

  return query select v_out_id, v_in_id;
end;
$$;

-- ============================================================
-- 6. receipts —— 收据照片
-- ============================================================
create table receipts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table receipts enable row level security;

-- ============================================================
-- 收据文件本体存在 Storage 的 receipts 这个 bucket 里（私有，不公开），
-- 路径规定为 <trip_id>/<entry_id>/<文件名>，这样才能用 role_level() 按
-- 路径第一段（trip_id）判断权限——跟其他表用同一套权限判断逻辑。
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_storage_select" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and role_level((storage.foldername(name))[1]::uuid) >= 1
  );

create policy "receipts_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and role_level((storage.foldername(name))[1]::uuid) >= 2
  );

create policy "receipts_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and role_level((storage.foldername(name))[1]::uuid) >= 2
  );

-- ============================================================
-- 7. comments —— 家人的提问与回复
-- ============================================================
create table comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

-- ============================================================
-- 8. push_subscriptions —— Web Push 订阅信息
-- ============================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (member_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- ============================================================
-- 9. trip_invites —— 邀请链接（id 本身就是邀请码，够长够随机，猜不到）
-- 只有 admin/owner 能看到、能生成；接受邀请走下面的 accept_invite() 函数，
-- 不是直接对这张表做 insert（陌生人一开始 role_level 是 0，RLS 规则也过不了）。
-- ============================================================
create table trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table trip_invites enable row level security;

-- ============================================================
-- accept_invite() —— 凭邀请码把自己加进 members 表
-- SECURITY DEFINER：接受邀请的人这时候还不是任何角色（role_level = 0），
-- 绕开 RLS 才能查到邀请码、才能把自己写进 members。
-- ============================================================
create or replace function accept_invite(p_invite_id uuid)
returns setof trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select ti.trip_id into v_trip_id
  from trip_invites ti
  where ti.id = p_invite_id and ti.revoked_at is null;

  if v_trip_id is null then
    raise exception 'This invite link is invalid or has been revoked';
  end if;

  insert into members (trip_id, user_id, display_name, role)
  values (v_trip_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Member'), 'member')
  on conflict (trip_id, user_id) do nothing;

  return query select * from trips where id = v_trip_id;
end;
$$;

-- ============================================================
-- RLS 策略
-- ============================================================

-- trips：成员能读，创建者也一定能读（不依赖"建账自动变成员"那个触发器的时间点——
-- 触发器和 INSERT ... RETURNING 的可见性在极少数情况下会打架，见 2026-08-25 的排查）；
-- 任何登录用户能建（建完触发器自动变 owner）；owner 能改/删
create policy "trips_read" on trips
  for select using (role_level(id) >= 1 or created_by = auth.uid());

create policy "trips_insert" on trips
  for insert with check (auth.uid() is not null);

create policy "trips_owner_manage" on trips
  for update using (role_level(id) >= 3);

create policy "trips_owner_delete" on trips
  for delete using (role_level(id) >= 3);

-- members：全员可读（透明）；admin+ 能邀请；owner 能改角色；
-- owner 能删任何人（owner 自己除外，见下面的触发器），
-- admin 只能删 member 级别的（动不了 admin/owner）
create policy "members_read" on members
  for select using (role_level(trip_id) >= 1);

create policy "members_insert" on members
  for insert with check (role_level(trip_id) >= 2);

create policy "members_owner_update_role" on members
  for update using (role_level(trip_id) >= 3);

-- owner 这一行本身不能被删——就算是 owner 自己发起的操作也不行，
-- 这条规则不看"谁在操作"，只看"要删的那一行是不是 owner"。
create policy "members_delete" on members
  for delete using (
    role <> 'owner'
    and (role_level(trip_id) >= 3 or (role_level(trip_id) >= 2 and role = 'member'))
  );

-- 光靠上面那条 RLS 还不够：owner 理论上还是能把自己的角色改成 admin/member，
-- 一旦改掉，这本账就再也没有 owner 了，谁都升不回去、也踢不动任何人。
-- 用触发器在数据库层面直接堵死"owner 这一行的 role 被改成别的东西"这件事，
-- 不管是谁、透过什么方式发起的更新都拦得住。
create or replace function prevent_owner_demotion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'The trip owner cannot be demoted';
  end if;
  return new;
end;
$$;

create trigger on_member_role_change
  before update on members
  for each row execute function prevent_owner_demotion();

-- wallets：全员可读；admin+ 全权限（增删改，含归档）
create policy "wallets_read" on wallets
  for select using (role_level(trip_id) >= 1);

create policy "wallets_admin_full" on wallets
  for all
  using (role_level(trip_id) >= 2)
  with check (role_level(trip_id) >= 2);

-- entries：全员可读；admin+ 能新增/修改，没有任何限制（CLAUDE.md 铁律二）。
-- 故意不给 delete policy：删除一律走"改 deleted_at"这个软删除路径，
-- 数据库层面直接不允许真删除，避免连带把 entry_history 的审计记录一起弄丢。
create policy "entries_read" on entries
  for select using (role_level(trip_id) >= 1);

create policy "entries_insert" on entries
  for insert with check (role_level(trip_id) >= 2);

create policy "entries_update" on entries
  for update
  using (role_level(trip_id) >= 2)
  with check (role_level(trip_id) >= 2);

-- entry_history：全员只读，没有 insert/update/delete policy——
-- 只有 security definer 触发器能写，任何人（含 admin）都没有直接写入的路径
create policy "entry_history_read" on entry_history
  for select using (role_level(trip_id) >= 1);

-- receipts：全员可读；admin+ 能上传/删除
create policy "receipts_read" on receipts
  for select using (role_level(trip_id) >= 1);

create policy "receipts_admin_manage" on receipts
  for insert with check (role_level(trip_id) >= 2);

create policy "receipts_admin_delete" on receipts
  for delete using (role_level(trip_id) >= 2);

-- comments：全员可读；成员只能以自己的身份发；
-- 自己能删自己的评论，admin+ 能删任何评论（管理垃圾/误发）
create policy "comments_read" on comments
  for select using (role_level(trip_id) >= 1);

create policy "comments_insert" on comments
  for insert with check (role_level(trip_id) >= 1 and author_id = auth.uid());

create policy "comments_delete" on comments
  for delete using (author_id = auth.uid() or role_level(trip_id) >= 2);

-- push_subscriptions：只有本人能管理自己的订阅
create policy "push_subscriptions_own" on push_subscriptions
  for all
  using (exists (
    select 1 from members m
    where m.id = push_subscriptions.member_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from members m
    where m.id = push_subscriptions.member_id and m.user_id = auth.uid()
  ));

-- trip_invites：只有 admin/owner 能看/建/撤销邀请链接。
-- 接受邀请的人不需要（也不允许）直接读这张表，全部走 accept_invite() 函数。
create policy "trip_invites_admin_manage" on trip_invites
  for all
  using (role_level(trip_id) >= 2)
  with check (role_level(trip_id) >= 2);

-- ============================================================
-- 10. settlements —— 结算快照
-- 只存一份"当时算出来的结果"，不锁账本、不生成任何抵消记账的 entries——
-- 确认结算之后 admin 还是能照常记账、改动、删除，跟"admin 权限不受限"这条铁律一致。
-- 每个钱包分开结算、不跨币种合并（钱包本来就分开算余额，结算延续同一个逻辑）。
-- snapshot 存当时算出的每人「交了多少/该承担多少/该退多少」，方便回头对照，
-- 不需要重新按当时的记账状态反推。
-- ============================================================
create table settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  snapshot jsonb not null
);

alter table settlements enable row level security;

create policy "settlements_read" on settlements
  for select using (role_level(trip_id) >= 1);

create policy "settlements_insert" on settlements
  for insert with check (role_level(trip_id) >= 2);

create policy "settlements_delete" on settlements
  for delete using (role_level(trip_id) >= 2);

-- ============================================================
-- 11. Web Push —— 这本账里发生的任何事，几乎即时推给家人；外加每晚一条汇总
-- 整条链路：各种表的触发器把"发生了什么"写成一句人话存进 activity_events ->
-- 存进去这个动作本身的触发器立刻用 pg_net 调用 Edge Function send-push ->
-- Edge Function 用 VAPID 签名真的把推送发出去。全程没有排队等待，插入即发送。
-- 数据库这边完全不知道怎么加密/签名推送内容，只负责"发生了什么、该不该发、发给谁"。
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 这本账里任何"值得让家人知道"的事——新记账、改动、删除、还原、加评论、
-- 加钱包——都在这里存一句预先写好的人话摘要，cron 隔一分钟批量捞出来发。
-- 不挂在 entries 表自己身上（不像最早的设计只在 entries 加个 notified_at 字段），
-- 是因为评论、加钱包这些事根本不发生在 entries 表上，得有一个大家共用的地方。
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  summary text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table activity_events enable row level security;
-- 故意不给 authenticated 任何 policy——这张表只给 SECURITY DEFINER 的触发器/
-- cron 函数用，前端不需要也不应该直接读它，RLS 开着但没 policy 等于完全锁死。

-- 跟前端 money.ts 里 formatMinorUnits 的效果对齐（千分位、按 exponent 决定小数位），
-- 推送文案里报金额要用这个，不要在每个触发器里各自拼字符串。
create or replace function format_minor(p_minor bigint, p_exponent int)
returns text
language sql
immutable
as $$
  select case
    when p_exponent = 0 then to_char(p_minor, 'FM999,999,999,999')
    else to_char(p_minor / (10.0 ^ p_exponent), 'FM999,999,999,999.' || repeat('0', p_exponent))
  end;
$$;

-- 跟前端 money.ts 里 POSITIVE_TYPES 的口径必须完全一致，写成一个函数、
-- 两边（这里的余额计算、后面的结算通知）都用它，不要各自抄一遍判断式。
create or replace function entry_signed_amount(p_type text, p_amount_minor bigint)
returns bigint
language sql
immutable
as $$
  select case
    when p_type in ('contribution', 'fx_in', 'transfer_in', 'refund') then p_amount_minor
    else -p_amount_minor
  end;
$$;

-- 记账这边：新增/编辑/软删除/还原都算一件事，写一条 activity_events。
-- 换汇/转账一次操作会插两条互相配对的 entries（一出一入），只在"出"那条上报事件，
-- 不然一次 Move 会被算成两件事、推两条通知。
-- 依旧顺手保留了之前那个坑的修法：只有 notified_at 这个字段变化的更新不算真编辑，
-- 不然家人点开一笔账会看到一条谁都没改过内容的"update"历史。
create or replace function log_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_label text;
  v_exponent int;
  v_summary text;
begin
  select label, exponent into v_wallet_label, v_exponent
  from wallets where id = coalesce(new.wallet_id, old.wallet_id);

  if tg_op = 'INSERT' then
    insert into entry_history (entry_id, trip_id, action, before, after, changed_by)
    values (new.id, new.trip_id, 'insert', null, to_jsonb(new), auth.uid());

    if new.type in ('expense', 'contribution') then
      v_summary := initcap(new.type) || ' in ' || v_wallet_label || ': ' ||
        format_minor(new.amount_minor, v_exponent) ||
        coalesce(' (' || new.category || ')', '') ||
        coalesce(' — ' || new.note, '');
      insert into activity_events (trip_id, actor_user_id, summary)
      values (new.trip_id, new.created_by, v_summary);
    elsif new.type in ('transfer_out', 'fx_out') then
      insert into activity_events (trip_id, actor_user_id, summary)
      values (new.trip_id, new.created_by, 'Money moved from ' || v_wallet_label || ': ' || format_minor(new.amount_minor, v_exponent));
    end if;

    return new;
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(old) - 'notified_at') = (to_jsonb(new) - 'notified_at') then
      return new;
    end if;

    insert into entry_history (entry_id, trip_id, action, before, after, reason, changed_by)
    values (
      new.id, new.trip_id,
      case when new.deleted_at is not null and old.deleted_at is null then 'delete'
           when new.deleted_at is null and old.deleted_at is not null then 'restore'
           else 'update' end,
      to_jsonb(old), to_jsonb(new),
      nullif(current_setting('trip_fund.edit_reason', true), ''),
      auth.uid()
    );

    if new.deleted_at is not null and old.deleted_at is null then
      v_summary := 'Deleted from ' || v_wallet_label || ': ' || format_minor(new.amount_minor, v_exponent);
    elsif new.deleted_at is null and old.deleted_at is not null then
      v_summary := 'Restored in ' || v_wallet_label || ': ' || format_minor(new.amount_minor, v_exponent);
    else
      v_summary := 'Edited an entry in ' || v_wallet_label;
    end if;
    insert into activity_events (trip_id, actor_user_id, summary)
    values (new.trip_id, auth.uid(), v_summary);

    return new;
  end if;
  return null;
end;
$$;

-- 加钱包：wallets 表本来就没有 created_by 字段，事件里就不记是谁加的，
-- 单纯让大家知道"多了一个钱包"这件事。
create or replace function log_wallet_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_events (trip_id, summary)
  values (new.trip_id, 'New wallet added: ' || new.label || ' (' || new.currency || ')');
  return new;
end;
$$;

create trigger on_wallet_created
  after insert on wallets
  for each row execute function log_wallet_created();

-- 加评论：body 太长的话只截前 80 字，推送通知本来就不是拿来读全文的。
create or replace function log_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_events (trip_id, actor_user_id, summary)
  values (new.trip_id, new.author_id, 'New comment: ' || left(new.body, 80));
  return new;
end;
$$;

create trigger on_comment_created
  after insert on comments
  for each row execute function log_comment_created();

-- 把「域名」和「跟 Edge Function 之间的共享密码」存起来，这样 SQL 函数才读得到，
-- 不用把密码明文写死在函数定义里。
-- 原本想用 `alter database postgres set app.settings.xxx = ...`，但 Supabase
-- 托管的 Postgres 不让 SQL Editor 这边的 postgres 角色改数据库级别的自定义参数
-- （权限不够，报 42501），这条路走不通，改用 Supabase 自带的 Vault 存密钥。
-- 这两行要 Zachary 自己拿 .env 里的实际值填进去跑一次（占位符不能直接用），
-- 如果之前已经跑过一次，这两行会报"已存在"，跳过不用管。
-- select vault.create_secret('https://xxx.supabase.co', 'supabase_url');
-- select vault.create_secret('xxx', 'push_cron_secret');

-- 每件事发生的当下就直接推，不再攒批（2026-08-29 改的——Zachary 反馈等一分钟
-- 才收到通知太没效率）。代价跟当初想避免的问题是同一件事：如果一顿饭连续记了
-- 好几笔，手机会连响好几声，不会合并成一条。先接受这个取舍，如果之后家人真的
-- 因为响太多次而想关通知，再回来考虑合并。
-- 触发时机是 activity_events 表本身的 insert，不是记账/评论/加钱包各自的表——
-- 这样送信这件事只写一个地方，各种"发生了什么"的触发器都不用各自管发送逻辑。
create or replace function notify_activity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_excluded uuid[];
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    return new;
  end if;

  if new.actor_user_id is not null then
    select array_agg(m.id) into v_excluded
    from members m
    where m.trip_id = new.trip_id and m.user_id = new.actor_user_id;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object(
      'type', 'activity',
      'trip_id', new.trip_id,
      'summary', new.summary,
      'exclude_member_ids', coalesce(to_jsonb(v_excluded), '[]'::jsonb)
    )
  );

  update activity_events set notified_at = now() where id = new.id;

  return new;
end;
$$;

create trigger on_activity_event_created
  after insert on activity_events
  for each row execute function notify_activity_event();

-- 每晚一条汇总（默认马来西亚时间 21:00 = UTC 13:00，印尼 WIB 只差 1 小时，
-- 想改时间的话直接改下面这行的 cron 表达式重跑就行，不用动函数本身）。
-- 当天完全没动静的钱包不推——大家都知道没花钱，不用刷存在感。
create or replace function notify_daily_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_url text;
  v_secret text;
  v_balance bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  for r in
    select
      w.id as wallet_id, w.trip_id, w.label as wallet_label, w.currency, w.exponent,
      coalesce(sum(case when e.type = 'expense' and e.deleted_at is null and e.created_at >= now() - interval '1 day' then e.amount_minor else 0 end), 0) as spent_today_minor,
      coalesce(sum(case when e.type = 'contribution' and e.deleted_at is null and e.created_at >= now() - interval '1 day' then e.amount_minor else 0 end), 0) as contributed_today_minor,
      count(*) filter (where e.deleted_at is null and e.created_at >= now() - interval '1 day') as entries_today
    from wallets w
    left join entries e on e.wallet_id = w.id
    group by w.id, w.trip_id, w.label, w.currency, w.exponent
  loop
    if r.entries_today = 0 then
      continue;
    end if;

    select coalesce(sum(entry_signed_amount(type, amount_minor)), 0) into v_balance
    from entries where wallet_id = r.wallet_id and deleted_at is null;

    perform net.http_post(
      url := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object(
        'type', 'daily',
        'trip_id', r.trip_id,
        'wallet_label', r.wallet_label,
        'currency', r.currency,
        'exponent', r.exponent,
        'spent_today_minor', r.spent_today_minor,
        'contributed_today_minor', r.contributed_today_minor,
        'balance_minor', v_balance
      )
    );
  end loop;
end;
$$;

select cron.schedule('notify-daily-summary', '0 13 * * *', $$select notify_daily_summary();$$);

-- ============================================================
-- 显式授权给 authenticated 角色
-- 建项目时关掉了 "Automatically expose new tables"，所以这一步不会自动发生。
-- 这里只是"允许尝试读写"，真正决定"能看到/改到哪些行"的还是上面那些 RLS 策略。
-- 没有登录的人（anon 角色）不给任何权限。
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function accept_invite(uuid) to authenticated;
grant execute on function update_entry_fields(uuid, bigint, text, text, timestamptz, uuid, text, text) to authenticated;
grant execute on function soft_delete_entry(uuid, text) to authenticated;
grant execute on function restore_entry(uuid, text) to authenticated;
grant execute on function create_transfer(uuid, uuid, uuid, bigint, bigint, text, text, numeric, text, text, timestamptz) to authenticated;

-- ============================================================
-- 显式授权给 service_role（send-push 这个 Edge Function 用这个身份连数据库）
-- 同样因为关掉了 "Automatically expose new tables"，这个角色也不会自动拿到权限——
-- 实测踩过这个坑：Edge Function 用 service_role 查 push_subscriptions 时被拒绝，
-- 报 "permission denied for table push_subscriptions"，因为一直只给了 authenticated。
-- service_role 本来就该有完整权限（只有我们自己的后台代码用得到这把钥匙，
-- 不会给浏览器），所以直接开放所有表。
-- ============================================================
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- ============================================================
-- 实时同步：前端订阅了这几张表的变化，得先让它们加入这个发布，
-- 不然订阅了也收不到任何通知。
-- ============================================================
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table wallets;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table settlements;
