-- CampusMarket database schema (Supabase / PostgreSQL)
-- Module 1: tables, validation rules, indexes and Row Level Security

-- ========== TABLES ==========

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  department text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  course_code text,
  category text not null default 'textbook' check (category in ('textbook','lab_equipment')),
  condition text not null check (condition in ('new','like_new','good','fair')),
  price numeric(10,2) check (price >= 0),
  exchange_only boolean not null default false,
  description text,
  status text not null default 'available' check (status in ('available','reserved','sold','hidden')),
  created_at timestamptz not null default now()
);

create index listings_course_code_idx on listings (lower(course_code));

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  message text,
  meeting_note text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed')),
  created_at timestamptz not null default now()
);

-- One pending request per buyer per listing
create unique index one_pending_request_idx on requests (listing_id, buyer_id) where status = 'pending';

create table reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (reason in ('scam','wrong_information','inappropriate','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewed','action_taken')),
  created_at timestamptz not null default now()
);

-- ========== ROW LEVEL SECURITY ==========

alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table requests enable row level security;
alter table reports enable row level security;

-- profiles
create policy "profiles are viewable by everyone" on profiles
  for select using (true);
create policy "users create own profile" on profiles
  for insert with check (auth.uid() = id and role = 'student');
create policy "users update own profile" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from profiles p where p.id = auth.uid()));

-- listings
create policy "listings are viewable" on listings
  for select using (
    status <> 'hidden'
    or seller_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "users create own listings" on listings
  for insert with check (auth.uid() = seller_id);
create policy "sellers update own listings" on listings
  for update using (auth.uid() = seller_id);
create policy "sellers delete own listings" on listings
  for delete using (auth.uid() = seller_id);

-- listing_images
create policy "images are viewable" on listing_images
  for select using (true);
create policy "sellers add images" on listing_images
  for insert with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "sellers delete images" on listing_images
  for delete using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- requests
create policy "buyer or seller views request" on requests
  for select using (
    buyer_id = auth.uid()
    or exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
  );
create policy "buyers create requests" on requests
  for insert with check (
    buyer_id = auth.uid()
    and exists (select 1 from listings l where l.id = listing_id and l.seller_id <> auth.uid())
  );
create policy "sellers update request status" on requests
  for update using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- reports
create policy "users create reports" on reports
  for insert with check (reporter_id = auth.uid());
create policy "admins view reports" on reports
  for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admins update reports" on reports
  for update using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
