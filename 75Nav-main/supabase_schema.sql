-- 1. 用户表 (Users) - 用于存储公开的用户信息
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  username text,
  nickname text,
  avatar_url text,
  signature text,
  badge text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用行级安全策略 (RLS)
alter table public.users enable row level security;

-- 策略：所有用户可查看所有用户信息（用于留言板显示头像昵称等）
create policy "Public profiles are viewable by everyone." on public.users for select using ( true );
-- 策略：用户只能插入自己的信息
create policy "Users can insert their own profile." on public.users for insert with check ( auth.uid() = id );
-- 策略：用户只能更新自己的信息
create policy "Users can update own profile." on public.users for update using ( auth.uid() = id );


-- 2. 书签分类表 (Categories)
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  title text not null,
  icon_name text default 'Hash',
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.categories enable row level security;
create policy "Users can view own categories" on public.categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on public.categories for delete using (auth.uid() = user_id);


-- 3. 书签链接表 (Links)
create table public.links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  title text not null,
  url text not null,
  description text,
  icon_name text default 'Globe',
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.links enable row level security;
create policy "Users can view own links" on public.links for select using (auth.uid() = user_id);
create policy "Users can insert own links" on public.links for insert with check (auth.uid() = user_id);
create policy "Users can update own links" on public.links for update using (auth.uid() = user_id);
create policy "Users can delete own links" on public.links for delete using (auth.uid() = user_id);


-- 4. AI 会话表 (Chat Sessions)
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.sessions enable row level security;
create policy "Users can manage own sessions" on public.sessions for all using (auth.uid() = user_id);


-- 5. AI 消息表 (Chat Messages)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  role text not null, -- 'user' or 'model'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.messages enable row level security;
create policy "Users can manage own messages" on public.messages for all using (auth.uid() = user_id);


-- 6. 灵感集表 (Sparks)
create table public.sparks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  type text not null, -- 'text' or 'image'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.sparks enable row level security;
create policy "Users can manage own sparks" on public.sparks for all using (auth.uid() = user_id);


-- 7. 留言板表 (Guestbook Messages)
create table public.guestbook_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  content text not null,
  nickname text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.guestbook_messages enable row level security;
create policy "Everyone can view guestbook" on public.guestbook_messages for select using (true);
create policy "Users can insert guestbook messages" on public.guestbook_messages for insert with check (auth.uid() = user_id);
create policy "Users can delete own guestbook messages" on public.guestbook_messages for delete using (auth.uid() = user_id);


-- 8. 喜欢的音乐表 (Liked Songs)
create table public.liked_songs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  song_id text not null,
  source text not null,
  name text,
  artist text,
  album text,
  cover_url text,
  duration integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, song_id)
);
alter table public.liked_songs enable row level security;
create policy "Users can manage own likes" on public.liked_songs for all using (auth.uid() = user_id);


-- 9. 音乐播放历史表 (Music History)
create table public.music_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  song_id text not null,
  source text not null,
  name text,
  artist text,
  album text,
  cover_url text,
  duration integer,
  played_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, song_id)
);
alter table public.music_history enable row level security;
create policy "Users can manage own history" on public.music_history for all using (auth.uid() = user_id);


-- 10. 自动触发器：当 Auth 用户创建时，自动在 public.users 表中创建记录
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- 先删除旧触发器（如果存在）以免报错
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
