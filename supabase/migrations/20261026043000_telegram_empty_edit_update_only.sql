CREATE OR REPLACE FUNCTION public.telegram_member_upsert_messages(
  p_user_id uuid,
  p_messages jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  affected integer := 0;
  updated integer := 0;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_messages) <> 'array' THEN
    RAISE EXCEPTION 'invalid message batch' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.telegram_member_messages AS current_message
    (user_id, chat_id, message_id, message_text, sender_name, message_date, edited_at)
  SELECT p_user_id,
         (item ->> 'chat_id')::bigint,
         (item ->> 'message_id')::bigint,
         item ->> 'message_text',
         COALESCE(item ->> 'sender_name', ''),
         (item ->> 'message_date')::timestamptz,
         NULLIF(item ->> 'edited_at', '')::timestamptz
  FROM jsonb_array_elements(p_messages) AS items(item)
  WHERE COALESCE(item ->> 'message_text', '') <> ''
  ON CONFLICT (user_id, chat_id, message_id) DO UPDATE
    SET message_text = EXCLUDED.message_text,
        sender_name = EXCLUDED.sender_name,
        message_date = EXCLUDED.message_date,
        edited_at = EXCLUDED.edited_at
    WHERE EXCLUDED.edited_at IS NOT NULL
      AND (current_message.edited_at IS NULL
           OR EXCLUDED.edited_at > current_message.edited_at);
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.telegram_member_messages AS current_message
  SET message_text = '',
      sender_name = COALESCE(item ->> 'sender_name', ''),
      message_date = (item ->> 'message_date')::timestamptz,
      edited_at = (item ->> 'edited_at')::timestamptz
  FROM jsonb_array_elements(p_messages) AS items(item)
  WHERE COALESCE(item ->> 'message_text', '') = ''
    AND NULLIF(item ->> 'edited_at', '') IS NOT NULL
    AND current_message.user_id = p_user_id
    AND current_message.chat_id = (item ->> 'chat_id')::bigint
    AND current_message.message_id = (item ->> 'message_id')::bigint
    AND (current_message.edited_at IS NULL
         OR (item ->> 'edited_at')::timestamptz > current_message.edited_at);
  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN affected + updated;
END;
$function$;
