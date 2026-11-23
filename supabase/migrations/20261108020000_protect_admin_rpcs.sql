-- Guard existing admin RPCs against changes to protected Admin accounts.
-- Fail closed if upstream function bodies differ; no customer rows are modified.
DO $migration$
DECLARE
  fn text;
  old_fragment text;
  new_fragment text;
  target regprocedure;
BEGIN
  target := 'public.admin_member_change(uuid,text,text)'::regprocedure;
  fn := pg_get_functiondef(target);
  old_fragment := '  IF p_action = ''grant'' THEN';
  new_fragment := E'  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) THEN\n    RAISE EXCEPTION ''Không thể thay đổi gói của Admin'' USING ERRCODE = ''42501'';\n  END IF;\n\n' || old_fragment;
  IF position(old_fragment IN fn) = 0 OR position('Không thể thay đổi gói của Admin' IN fn) > 0 THEN
    RAISE EXCEPTION 'Unexpected definition for %', target;
  END IF;
  EXECUTE replace(fn, old_fragment, new_fragment);

  target := 'public.admin_reset_device(uuid)'::regprocedure;
  fn := pg_get_functiondef(target);
  old_fragment := '  delete from public.devices';
  new_fragment := E'  if exists (select 1 from public.admin_users where user_id=p_user_id) then\n    return jsonb_build_object(''ok'',false,''message'',''Không thể reset thiết bị Admin.'');\n  end if;\n\n' || old_fragment;
  IF position(old_fragment IN fn) = 0 OR position('Không thể reset thiết bị Admin.' IN fn) > 0 THEN
    RAISE EXCEPTION 'Unexpected definition for %', target;
  END IF;
  EXECUTE replace(fn, old_fragment, new_fragment);

  target := 'public.admin_activate_license(uuid,text,integer,text)'::regprocedure;
  fn := pg_get_functiondef(target);
  old_fragment := '  select expires_at';
  new_fragment := E'  if exists (select 1 from public.admin_users where user_id=p_user_id) then\n    return jsonb_build_object(''ok'',false,''message'',''Không thể thay đổi bản quyền Admin.'');\n  end if;\n\n' || old_fragment;
  IF position(old_fragment IN fn) = 0 OR position('Không thể thay đổi bản quyền Admin.' IN fn) > 0 THEN
    RAISE EXCEPTION 'Unexpected definition for %', target;
  END IF;
  EXECUTE replace(fn, old_fragment, new_fragment);

  target := 'public.admin_set_license_active(uuid,boolean)'::regprocedure;
  fn := pg_get_functiondef(target);
  old_fragment := '  update public.licenses';
  new_fragment := E'  if exists (select 1 from public.admin_users where user_id=p_user_id) then\n    return jsonb_build_object(''ok'',false,''message'',''Không thể thay đổi bản quyền Admin.'');\n  end if;\n\n' || old_fragment;
  IF position(old_fragment IN fn) = 0 OR position('Không thể thay đổi bản quyền Admin.' IN fn) > 0 THEN
    RAISE EXCEPTION 'Unexpected definition for %', target;
  END IF;
  EXECUTE replace(fn, old_fragment, new_fragment);
END
$migration$;
