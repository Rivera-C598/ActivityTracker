-- run this in your Supabase SQL editor

-- 1. Create students table
create table public.students (
  id uuid primary key default gen_random_uuid(),
  lastname text not null,
  firstname text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create submissions table
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid null references public.students(id) on delete cascade,
  activity_key text not null, -- 'act5', 'act6', 'act7', 'act8', 'act9', 'final'
  status text not null default 'pending', -- 'pending', 'pass', 'resubmit', 'oral', 'missing'
  remarks text[] null default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, activity_key)
);

-- 3. Enable Row Level Security (RLS)
alter table public.students enable row level security;
alter table public.submissions enable row level security;

-- 4. Create Policies for Students
-- Public read access
create policy "Public can view students" 
on public.students for select using (true);

-- Authenticated users (teachers) can do everything
create policy "Auth users can manage students" 
on public.students for all to authenticated using (true) with check (true);

-- 5. Create Policies for Submissions
-- Public read access
create policy "Public can view submissions" 
on public.submissions for select using (true);

-- Authenticated users (teachers) can do everything
create policy "Auth users can manage submissions" 
on public.submissions for all to authenticated using (true) with check (true);

-- 6. Optional: Insert a test user if you want
-- insert into public.students (firstname, lastname) values ('John', 'Doe');
