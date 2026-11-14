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

alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table requests enable row level security;
alter table reports enable row level security;

create policy "profiles are viewable by everyone" on profiles
  for select using (true);
create policy "users create own profile" on profiles
  for insert with check (auth.uid() = id and role = 'student');
create policy "users update own profile" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from profiles p where p.id = auth.uid()));

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

create policy "images are viewable" on listing_images
  for select using (true);
create policy "sellers add images" on listing_images
  for insert with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "sellers delete images" on listing_images
  for delete using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));

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

create policy "users create reports" on reports
  for insert with check (reporter_id = auth.uid());
create policy "admins view reports" on reports
  for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admins update reports" on reports
  for update using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

alter table listings add column file_path text;

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('listing-files', 'listing-files', false) on conflict (id) do nothing;

create policy "users upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "sellers upload own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller or approved buyer can read file" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from requests r join listings l on l.id = r.listing_id
        where r.buyer_id = auth.uid()
          and r.status in ('accepted','completed')
          and l.file_path = name
      )
    )
  );

alter table profiles add column is_seller boolean not null default false;
alter table profiles add column seller_terms_accepted_at timestamptz;

drop policy "users create own listings" on listings;
create policy "sellers create own listings" on listings
  for insert with check (
    auth.uid() = seller_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.is_seller = true)
  );

create table if not exists payment_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  method text not null check (method in ('easypaisa','jazzcash')),
  account_number text not null check (account_number ~ '^03[0-9]{9}$'),
  account_name text not null,
  created_at timestamptz not null default now()
);
alter table payment_accounts enable row level security;
create policy "logged in users view payment accounts" on payment_accounts
  for select to authenticated using (true);
create policy "owner manages own payment account" on payment_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table requests add column if not exists transaction_id text;
alter table requests add column if not exists proof_path text;
alter table requests add column if not exists amount numeric(10,2);
alter table requests add column if not exists payment_method text;
alter table requests add column if not exists auto_released boolean not null default false;
alter table requests add column if not exists proof_check text;
alter table requests add column if not exists disputed boolean not null default false;

create unique index if not exists requests_transaction_id_idx
  on requests (lower(transaction_id)) where transaction_id is not null;

drop policy if exists "buyers create requests" on requests;
create policy "buyers create requests" on requests
  for insert with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and auto_released = false
    and transaction_id is null
    and exists (select 1 from listings l where l.id = listing_id and l.seller_id <> auth.uid())
  );

create or replace function submit_payment_request(
  p_listing_id uuid,
  p_message text,
  p_meeting_note text,
  p_transaction_id text,
  p_proof_path text,
  p_proof_check text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_method text;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Please login first.';
  end if;

  select * into v_listing from listings where id = p_listing_id;
  if not found then raise exception 'Listing not found.'; end if;
  if v_listing.status <> 'available' then raise exception 'This item is no longer available.'; end if;
  if v_listing.seller_id = auth.uid() then raise exception 'You cannot buy your own listing.'; end if;
  if v_listing.exchange_only or v_listing.price is null then
    raise exception 'This listing has no price. Send a normal request instead.';
  end if;
  if v_listing.file_path is null then raise exception 'This listing has no file to release.'; end if;

  select method into v_method from payment_accounts where user_id = v_listing.seller_id;
  if v_method is null then raise exception 'The seller has not added a payment account yet.'; end if;

  if p_transaction_id is null
     or length(trim(p_transaction_id)) < 8
     or trim(p_transaction_id) !~ '^[A-Za-z0-9]+$' then
    raise exception 'Please enter a valid transaction ID (letters and numbers, at least 8 characters).';
  end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'The payment screenshot is missing.';
  end if;

  v_status := case when p_proof_check = 'amount_matched' then 'accepted' else 'pending' end;

  insert into requests (listing_id, buyer_id, message, meeting_note, status,
                        transaction_id, proof_path, amount, payment_method, auto_released, proof_check)
  values (p_listing_id, auth.uid(), coalesce(p_message, ''), p_meeting_note, v_status,
          trim(p_transaction_id), p_proof_path, v_listing.price, v_method,
          (v_status = 'accepted'), p_proof_check)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function submit_payment_request(uuid, text, text, text, text, text) from public, anon;
grant execute on function submit_payment_request(uuid, text, text, text, text, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "buyers upload own proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "buyer or seller reads proof" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from requests r join listings l on l.id = r.listing_id
        where r.proof_path = name and l.seller_id = auth.uid()
      )
    )
  );

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, is_read, created_at desc);

alter table notifications enable row level security;
create policy "users read own notifications" on notifications
  for select to authenticated using (user_id = auth.uid());
create policy "users update own notifications" on notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated, anon;
grant update (is_read) on notifications to authenticated;

create or replace function notify_new_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_seller uuid;
  v_buyer text;
begin
  select title, seller_id into v_title, v_seller from listings where id = new.listing_id;
  select coalesce(full_name, 'A student') into v_buyer from profiles where id = new.buyer_id;

  if new.auto_released then
    insert into notifications (user_id, message, link) values (v_seller,
      v_buyer || ' paid Rs. ' || new.amount || ' for "' || v_title || '" and the file was released automatically. Please verify the payment.',
      'requests.html');
  elsif new.transaction_id is not null then
    insert into notifications (user_id, message, link) values (v_seller,
      v_buyer || ' sent a payment of Rs. ' || new.amount || ' for "' || v_title || '". Please check it and accept.',
      'requests.html');
  else
    insert into notifications (user_id, message, link) values (v_seller,
      v_buyer || ' sent a request for "' || v_title || '".',
      'requests.html');
  end if;
  return new;
end;
$$;

create trigger trg_notify_new_request
  after insert on requests
  for each row execute function notify_new_request();

create or replace function notify_request_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  select title into v_title from listings where id = new.listing_id;

  if new.status = 'accepted' then
    insert into notifications (user_id, message, link) values (new.buyer_id,
      'Your request for "' || v_title || '" was accepted.',
      'listing.html?id=' || new.listing_id);
  elsif new.status = 'declined' and new.disputed then
    insert into notifications (user_id, message, link) values (new.buyer_id,
      'The seller reported that the payment for "' || v_title || '" was not received. Access to the file was removed.',
      'requests.html');
  elsif new.status = 'declined' then
    insert into notifications (user_id, message, link) values (new.buyer_id,
      'Your request for "' || v_title || '" was declined.',
      'requests.html');
  elsif new.status = 'completed' then
    insert into notifications (user_id, message, link) values (new.buyer_id,
      'Your request for "' || v_title || '" was marked as completed.',
      'requests.html');
  end if;
  return new;
end;
$$;

create trigger trg_notify_request_status
  after update of status on requests
  for each row
  when (old.status is distinct from new.status)
  execute function notify_request_status();

alter publication supabase_realtime add table notifications;

alter table reports drop constraint if exists reports_reason_check;
alter table reports add constraint reports_reason_check
  check (reason in ('scam','wrong_information','inappropriate','copyright','not_study_related','other'));

create unique index if not exists reports_one_per_user_idx on reports (listing_id, reporter_id);

drop policy if exists "users create reports" on reports;
create policy "users create reports" on reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and exists (select 1 from listings l where l.id = listing_id and l.seller_id <> auth.uid())
  );

drop policy if exists "reporters view own reports" on reports;
create policy "reporters view own reports" on reports
  for select to authenticated using (reporter_id = auth.uid());

drop policy if exists "admins update listings" on listings;
create policy "admins update listings" on listings
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function notify_listing_hidden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, message, link) values (new.seller_id,
    'Your listing "' || new.title || '" was hidden by an admin after a report. Contact the student council if you think this is a mistake.',
    'my-listings.html');
  return new;
end;
$$;

drop trigger if exists trg_notify_listing_hidden on listings;
create trigger trg_notify_listing_hidden
  after update of status on listings
  for each row
  when (old.status is distinct from new.status and new.status = 'hidden')
  execute function notify_listing_hidden();

alter table listings add column if not exists copyright_confirmed boolean not null default false;
alter table listings add column if not exists file_hash text;
create index if not exists listings_file_hash_idx on listings (file_hash) where file_hash is not null;

create or replace function check_file_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.file_hash is not null
     and (select count(*) from listings where file_hash = new.file_hash) >= 3 then
    raise exception 'This file has already been uploaded 3 times.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_file_limit on listings;
create trigger trg_check_file_limit
  before insert on listings
  for each row execute function check_file_limit();

create or replace function count_file_uploads(p_hash text) returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int from listings where file_hash = p_hash;
$$;
revoke execute on function count_file_uploads(text) from public, anon;
grant execute on function count_file_uploads(text) to authenticated;

drop policy if exists "sellers create own listings" on listings;
create policy "sellers create own listings" on listings
  for insert with check (
    auth.uid() = seller_id
    and copyright_confirmed = true
    and exists (select 1 from profiles p where p.id = auth.uid() and p.is_seller = true)
  );

create or replace function protect_hidden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'hidden' and new.status <> 'hidden'
     and not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only an admin can restore a hidden listing.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_hidden on listings;
create trigger trg_protect_hidden
  before update of status on listings
  for each row execute function protect_hidden();
