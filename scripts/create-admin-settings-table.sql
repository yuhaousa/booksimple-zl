-- Admin settings table for secure runtime configuration values
-- Run this in Supabase SQL Editor before using /api/admin/settings/ai-key

CREATE TABLE IF NOT EXISTS public.admin_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at
  ON public.admin_settings (updated_at DESC);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
DROP POLICY IF EXISTS "admin_settings_select_admins" ON public.admin_settings;
CREATE POLICY "admin_settings_select_admins"
  ON public.admin_settings
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users
    )
  );

-- Admin-only insert access
DROP POLICY IF EXISTS "admin_settings_insert_admins" ON public.admin_settings;
CREATE POLICY "admin_settings_insert_admins"
  ON public.admin_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users
    )
  );

-- Admin-only update access
DROP POLICY IF EXISTS "admin_settings_update_admins" ON public.admin_settings;
CREATE POLICY "admin_settings_update_admins"
  ON public.admin_settings
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users
    )
  );

-- Admin-only delete access
DROP POLICY IF EXISTS "admin_settings_delete_admins" ON public.admin_settings;
CREATE POLICY "admin_settings_delete_admins"
  ON public.admin_settings
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users
    )
  );

