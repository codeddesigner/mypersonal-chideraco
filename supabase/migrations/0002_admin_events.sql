-- Admins may record events on behalf of a reader (e.g. subscription_completed).
alter policy "Anyone records events" on public.events
  with check (user_id is null or user_id = (select auth.uid()) or (select private.is_admin()));
