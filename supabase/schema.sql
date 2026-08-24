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
    'transfer', 'reimbursement', 'refund', 'settlement'
  )),
  amount_minor bigint not null,
  fx_rate numeric,
  category text,
  note text,
  occurred_at timestamptz not null default now(),
  paired_entry_id uuid references entries(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
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
    insert into entry_history (entry_id, trip_id, action, before, after, changed_by)
    values (
      new.id, new.trip_id,
      case when new.deleted_at is not null and old.deleted_at is null then 'delete'
           when new.deleted_at is null and old.deleted_at is not null then 'restore'
           else 'update' end,
      to_jsonb(old), to_jsonb(new), auth.uid()
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
-- RLS 策略
-- ============================================================

-- trips：成员能读；任何登录用户能建（建完触发器自动变 owner）；owner 能改/删
create policy "trips_read" on trips
  for select using (role_level(id) >= 1);

create policy "trips_insert" on trips
  for insert with check (auth.uid() is not null);

create policy "trips_owner_manage" on trips
  for update using (role_level(id) >= 3);

create policy "trips_owner_delete" on trips
  for delete using (role_level(id) >= 3);

-- members：全员可读（透明）；admin+ 能邀请；owner 能改角色；
-- owner 能删任何人，admin 只能删 member 级别的（动不了 admin/owner）
create policy "members_read" on members
  for select using (role_level(trip_id) >= 1);

create policy "members_insert" on members
  for insert with check (role_level(trip_id) >= 2);

create policy "members_owner_update_role" on members
  for update using (role_level(trip_id) >= 3);

create policy "members_delete" on members
  for delete using (
    role_level(trip_id) >= 3
    or (role_level(trip_id) >= 2 and role = 'member')
  );

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

-- ============================================================
-- 显式授权给 authenticated 角色
-- 建项目时关掉了 "Automatically expose new tables"，所以这一步不会自动发生。
-- 这里只是"允许尝试读写"，真正决定"能看到/改到哪些行"的还是上面那些 RLS 策略。
-- 没有登录的人（anon 角色）不给任何权限。
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
