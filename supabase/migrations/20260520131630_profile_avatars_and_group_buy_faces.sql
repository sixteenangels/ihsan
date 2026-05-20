-- Profile avatars and safe group-buy social proof.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Profile avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Profile avatars are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Users can upload their own profile avatars" ON storage.objects;
CREATE POLICY "Users can upload their own profile avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can update their own profile avatars" ON storage.objects;
CREATE POLICY "Users can update their own profile avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Users can delete their own profile avatars" ON storage.objects;
CREATE POLICY "Users can delete their own profile avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_group_buy_participant_faces(
  p_group_buy_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  participant_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    gbp.id AS participant_id,
    COALESCE(NULLIF(split_part(btrim(p.name), ' ', 1), ''), 'AJYN member') AS display_name,
    p.avatar_url,
    gbp.joined_at
  FROM public.group_buy_participants gbp
  JOIN public.group_buys gb ON gb.id = gbp.group_buy_id
  LEFT JOIN public.profiles p ON p.user_id = gbp.user_id
  WHERE gbp.group_buy_id = p_group_buy_id
    AND gbp.payment_status = 'paid'
    AND gb.status IN ('open', 'filled', 'closed')
  ORDER BY gbp.joined_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 0), 16);
$function$;

REVOKE ALL ON FUNCTION private.get_group_buy_participant_faces(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION private.get_group_buy_participant_faces(uuid, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_group_buy_participant_faces(
  p_group_buy_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  participant_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT *
  FROM private.get_group_buy_participant_faces(p_group_buy_id, p_limit);
$function$;

REVOKE ALL ON FUNCTION public.get_group_buy_participant_faces(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_group_buy_participant_faces(uuid, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.get_group_buy_participant_faces(uuid, integer) IS
  'Returns public-safe avatar/name previews for paid group-buy participants without exposing private participant records.';

NOTIFY pgrst, 'reload schema';
