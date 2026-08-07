-- ===== 7. 20260807000000_profanity_escalation.sql =====

-- Add columns to profiles for tracking profanity violations and restrictions
alter table public.profiles 
add column if not exists profanity_warnings int not null default 0,
add column if not exists profanity_violations int not null default 0,
add column if not exists restriction_level text not null default 'none' check (restriction_level in ('none', 'warning', 'restricted', 'suspended')),
add column if not exists parent_email text,
add column if not exists principal_email text,
add column if not exists school_name text,
add column if not exists last_profanity_at timestamptz;

-- Table to track each profanity incident
create table public.profanity_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_text text not null,
  detected_words text[] not null,
  context_type text not null, -- 'post', 'thread', 'material', 'message'
  context_id uuid,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  action_taken text not null check (action_taken in ('warning', 'restriction', 'suspension', 'parent_notification', 'principal_notification')),
  created_at timestamptz not null default now()
);

create index idx_profanity_incidents_user on public.profanity_incidents (user_id, created_at desc);
create index idx_profanity_incidents_context on public.profanity_incidents (context_type, context_id);

alter table public.profanity_incidents enable row level security;

create policy "Users can view own profanity incidents" on public.profanity_incidents for select to authenticated using (auth.uid() = user_id);
create policy "Moderators can view all profanity incidents" on public.profanity_incidents for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')));
create policy "Server can insert profanity incidents" on public.profanity_incidents for insert to authenticated with check (true);

-- Table for email notifications sent
create table public.profanity_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  incident_id uuid not null references public.profanity_incidents (id) on delete cascade,
  recipient_type text not null check (recipient_type in ('parent', 'principal')),
  recipient_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_profanity_notifications_user on public.profanity_notifications (user_id, created_at desc);
create index idx_profanity_notifications_status on public.profanity_notifications (status, created_at);

alter table public.profanity_notifications enable row level security;

create policy "Moderators can view profanity notifications" on public.profanity_notifications for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')));
create policy "Server can insert profanity notifications" on public.profanity_notifications for insert to authenticated with check (true);
create policy "Server can update profanity notifications" on public.profanity_notifications for update to authenticated with check (true);

-- Function to handle profanity escalation
create or replace function public.handle_profanity_escalation(
  p_user_id uuid,
  p_content text,
  p_detected_words text[],
  p_context_type text,
  p_context_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_warning_count int;
  v_violation_count int;
  v_action_taken text;
  v_severity text;
  v_restriction_level text;
begin
  -- Get current profile
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  -- Determine severity based on detected words
  v_severity := case 
    when array_length(p_detected_words, 1) >= 3 then 'severe'
    when array_length(p_detected_words, 1) >= 2 then 'moderate'
    else 'mild'
  end;

  -- Increment counters
  v_warning_count := v_profile.profanity_warnings;
  v_violation_count := v_profile.profanity_violations + 1;

  -- Determine action based on escalation tier
  if v_profile.restriction_level = 'suspended' then
    v_action_taken := 'suspension';
  elsif v_profile.restriction_level = 'restricted' then
    v_action_taken := 'suspension';
    v_restriction_level := 'suspended';
  elsif v_profile.restriction_level = 'warning' then
    v_action_taken := 'restriction';
    v_restriction_level := 'restricted';
  else
    v_action_taken := 'warning';
    v_restriction_level := 'warning';
  end if;

  -- Update profile
  update public.profiles set
    profanity_warnings = v_warning_count + case when v_action_taken = 'warning' then 1 else 0 end,
    profanity_violations = v_violation_count,
    restriction_level = v_restriction_level,
    last_profanity_at = now()
  where id = p_user_id;

  -- Log the incident
  insert into public.profanity_incidents (
    user_id, content_text, detected_words, context_type, context_id, severity, action_taken
  ) values (
    p_user_id, p_content, p_detected_words, p_context_type, p_context_id, v_severity, v_action_taken
  );

  -- Log moderation action
  insert into public.moderation_actions (actor_id, action, target_type, target_id, note)
  values (p_user_id, 'profanity_' || v_action_taken, 'profile', p_user_id, 
    'Auto-detected profanity: ' || array_to_string(p_detected_words, ', '));

  -- Send notifications based on escalation level
  if v_action_taken = 'restriction' and v_profile.parent_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id, 
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'parent', v_profile.parent_email,
      'LearningFans: Content Moderation Notice - Restriction Applied',
      'Dear Parent/Guardian,

Your student ' || v_profile.display_name || ' has been restricted on LearningFans due to repeated profanity violations.

Details:
- Violation count: ' || v_violation_count || '
- Detected language: ' || array_to_string(p_detected_words, ', ') || '
- Context: ' || p_context_type || '
- Action: Account restricted to read-only mode

Please discuss appropriate online communication with your student. The restriction will be reviewed after 7 days of clean behavior.

- LearningFans Safety Team
'
    );
  end if;

  if v_action_taken = 'suspension' and v_profile.principal_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id,
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'principal', v_profile.principal_email,
      'LearningFans: Student Account Suspended - Policy Violation',
      'Dear Principal/Administrator,

A student from your school (' || coalesce(v_profile.school_name, 'Unknown School') || ') has been suspended from LearningFans due to severe repeated profanity violations.

Student: ' || v_profile.display_name || ' (' || v_profile.id || ')
Violation count: ' || v_violation_count || '
Detected language: ' || array_to_string(p_detected_words, ', ') || '
Context: ' || p_context_type || '
Action: Account suspended

This automated notification is sent per LearningFans safety policy when a student reaches the suspension tier. The student''s account is now suspended pending administrative review.

- LearningFans Safety Team
'
    );
  end if;

  -- Also notify parent on suspension
  if v_action_taken = 'suspension' and v_profile.parent_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id,
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'parent', v_profile.parent_email,
      'LearningFans: Account Suspended - Immediate Attention Required',
      'Dear Parent/Guardian,

Your student ' || v_profile.display_name || ' has been SUSPENDED from LearningFans due to severe repeated profanity violations.

This is the final escalation tier. The account is now suspended and cannot access LearningFans features.

Violation count: ' || v_violation_count || '
Detected language: ' || array_to_string(p_detected_words, ', ')
Context: ' || p_context_type || '

Please contact LearningFans support if you believe this is in error or to discuss reinstatement.

- LearningFans Safety Team
'
    );
  end if;
end;
$$;

-- Function to check if user is restricted
create or replace function public.is_profanity_restricted(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select restriction_level in ('restricted', 'suspended') from public.profiles where id = p_user_id; $$;

-- Function to get user's profanity status
create or replace function public.get_profanity_status(p_user_id uuid default auth.uid())
returns table (
  warnings int,
  violations int,
  restriction_level text,
  last_incident_at timestamptz
) language sql stable security definer set search_path = public
as $$ select profanity_warnings, profanity_violations, restriction_level, last_profanity_at from public.profiles where id = p_user_id; $$;