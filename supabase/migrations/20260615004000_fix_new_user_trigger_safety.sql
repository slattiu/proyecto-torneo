-- Migration: Fix new user trigger safety net
-- Project: Proyecto-Torneos

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username',
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'ADMIN'::user_role ELSE 'USER'::user_role END
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
