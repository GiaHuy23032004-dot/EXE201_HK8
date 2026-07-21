ALTER TABLE public.mentor_wallets
ADD COLUMN IF NOT EXISTS pending_withdrawal integer NOT NULL DEFAULT 0;

ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_reason text,
ADD COLUMN IF NOT EXISTS paid_reference text,
ADD COLUMN IF NOT EXISTS balance_snapshot integer,
ADD COLUMN IF NOT EXISTS pending_snapshot integer,
ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.withdrawal_requests
SET requested_at = COALESCE(requested_at, created_at, now())
WHERE requested_at IS NULL;

CREATE TABLE IF NOT EXISTS public.withdrawal_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('requested', 'approved_paid', 'rejected', 'repair_reserved', 'failed_attempt', 'note_added')),
  amount integer,
  old_status text,
  new_status text,
  old_balance integer,
  new_balance integer,
  old_pending_withdrawal integer,
  new_pending_withdrawal integer,
  performed_by uuid REFERENCES auth.users(id),
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_audit_logs
DROP CONSTRAINT IF EXISTS withdrawal_audit_logs_action_check;

ALTER TABLE public.withdrawal_audit_logs
ADD CONSTRAINT withdrawal_audit_logs_action_check
CHECK (action IN ('requested', 'approved_paid', 'rejected', 'repair_reserved', 'failed_attempt', 'note_added'));

ALTER TABLE public.withdrawal_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_audit_admin_read" ON public.withdrawal_audit_logs;
CREATE POLICY "withdrawal_audit_admin_read"
ON public.withdrawal_audit_logs
FOR SELECT
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "withdrawal_audit_mentor_read_own" ON public.withdrawal_audit_logs;
CREATE POLICY "withdrawal_audit_mentor_read_own"
ON public.withdrawal_audit_logs
FOR SELECT
TO authenticated
USING (mentor_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_withdrawal_audit_logs_request
ON public.withdrawal_audit_logs(withdrawal_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_audit_logs_mentor
ON public.withdrawal_audit_logs(mentor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created
ON public.withdrawal_requests(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.request_mentor_withdrawal(
  p_mentor_id uuid,
  p_amount integer,
  p_bank_name text,
  p_bank_account text,
  p_bank_holder text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.mentor_wallets%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_request public.withdrawal_requests%ROWTYPE;
  v_actor uuid := auth.uid();
  v_jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_reference text;
BEGIN
  IF p_mentor_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu mentor_id.';
  END IF;

  IF v_jwt_role <> 'service_role' AND (v_actor IS NULL OR p_mentor_id <> v_actor) THEN
    RAISE EXCEPTION 'Bạn chỉ có thể tạo yêu cầu rút tiền cho chính mình.';
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Số tiền rút phải lớn hơn 0.';
  END IF;

  IF NULLIF(TRIM(p_bank_name), '') IS NULL
    OR NULLIF(TRIM(p_bank_account), '') IS NULL
    OR NULLIF(TRIM(p_bank_holder), '') IS NULL THEN
    RAISE EXCEPTION 'Vui lòng cung cấp đầy đủ thông tin ngân hàng.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_mentor_id
  FOR UPDATE;

  IF NOT FOUND OR v_profile.role <> 'mentor' THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ mentor hợp lệ.';
  END IF;

  IF COALESCE(v_profile.is_blocked, false) THEN
    RAISE EXCEPTION 'Tài khoản mentor đang bị khóa, không thể tạo yêu cầu rút tiền.';
  END IF;

  SELECT * INTO v_wallet
  FROM public.mentor_wallets
  WHERE mentor_id = p_mentor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.mentor_wallets (mentor_id)
    VALUES (p_mentor_id)
    RETURNING * INTO v_wallet;
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Số dư khả dụng không đủ để rút tiền.';
  END IF;

  v_reference := 'WDR-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  UPDATE public.mentor_wallets
  SET balance = balance - p_amount,
      pending_withdrawal = pending_withdrawal + p_amount,
      updated_at = now()
  WHERE mentor_id = p_mentor_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.withdrawal_requests (
    mentor_id,
    reference_code,
    amount,
    bank_name,
    bank_account,
    bank_holder,
    status,
    balance_snapshot,
    pending_snapshot,
    requested_at,
    updated_at
  )
  VALUES (
    p_mentor_id,
    v_reference,
    p_amount,
    TRIM(p_bank_name),
    TRIM(p_bank_account),
    TRIM(p_bank_holder),
    'pending',
    v_wallet.balance,
    v_wallet.pending_withdrawal,
    now(),
    now()
  )
  RETURNING * INTO v_request;

  INSERT INTO public.wallet_transactions (
    mentor_id,
    kind,
    description,
    delta,
    balance_after,
    reference_code
  )
  VALUES (
    p_mentor_id,
    'withdraw',
    'Yêu cầu rút tiền đang chờ xử lý',
    -p_amount,
    v_wallet.balance,
    v_reference
  );

  INSERT INTO public.withdrawal_audit_logs (
    withdrawal_request_id,
    mentor_id,
    action,
    amount,
    old_status,
    new_status,
    old_balance,
    new_balance,
    old_pending_withdrawal,
    new_pending_withdrawal,
    performed_by,
    note
  )
  VALUES (
    v_request.id,
    p_mentor_id,
    'requested',
    p_amount,
    NULL,
    'pending',
    v_wallet.balance + p_amount,
    v_wallet.balance,
    v_wallet.pending_withdrawal - p_amount,
    v_wallet.pending_withdrawal,
    v_actor,
    'Mentor tạo yêu cầu rút tiền'
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_mentor_withdrawal(
  amount integer,
  payout_method_id uuid
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method public.mentor_payout_methods%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để tạo yêu cầu rút tiền.';
  END IF;

  SELECT * INTO v_method
  FROM public.mentor_payout_methods
  WHERE id = payout_method_id
    AND mentor_id = v_actor
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phương thức nhận tiền hợp lệ.';
  END IF;

  RETURN public.request_mentor_withdrawal(
    v_actor,
    amount,
    v_method.provider_name,
    v_method.account_number,
    v_method.account_holder
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_paid_reference text,
  p_admin_note text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.withdrawal_requests%ROWTYPE;
  v_wallet public.mentor_wallets%ROWTYPE;
  v_old_pending integer;
  v_actor uuid := auth.uid();
  v_jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu thông tin xử lý yêu cầu rút tiền.';
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Tài khoản xử lý không có quyền Admin.';
  END IF;

  IF v_jwt_role <> 'service_role' AND (v_actor IS NULL OR v_actor <> p_admin_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền xử lý yêu cầu rút tiền này.';
  END IF;

  IF NULLIF(TRIM(p_paid_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Vui lòng nhập mã tham chiếu chuyển khoản.';
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu rút tiền.';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Yêu cầu này đã được xử lý, không thể xử lý lại.';
  END IF;

  SELECT * INTO v_wallet
  FROM public.mentor_wallets
  WHERE mentor_id = v_request.mentor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ví mentor.';
  END IF;

  IF v_wallet.pending_withdrawal < v_request.amount THEN
    RAISE EXCEPTION 'Số dư rút tiền đang chờ không đủ, vui lòng kiểm tra lại ví mentor.';
  END IF;

  v_old_pending := v_wallet.pending_withdrawal;

  UPDATE public.mentor_wallets
  SET pending_withdrawal = pending_withdrawal - v_request.amount,
      updated_at = now()
  WHERE mentor_id = v_request.mentor_id
  RETURNING * INTO v_wallet;

  UPDATE public.withdrawal_requests
  SET status = 'paid',
      processed_by = p_admin_id,
      processed_at = now(),
      paid_reference = TRIM(p_paid_reference),
      processed_reference = TRIM(p_paid_reference),
      admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
      pending_snapshot = v_wallet.pending_withdrawal,
      balance_snapshot = v_wallet.balance,
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO public.withdrawal_audit_logs (
    withdrawal_request_id,
    mentor_id,
    action,
    amount,
    old_status,
    new_status,
    old_balance,
    new_balance,
    old_pending_withdrawal,
    new_pending_withdrawal,
    performed_by,
    note,
    metadata
  )
  VALUES (
    v_request.id,
    v_request.mentor_id,
    'approved_paid',
    v_request.amount,
    'pending',
    'paid',
    v_wallet.balance,
    v_wallet.balance,
    v_old_pending,
    v_wallet.pending_withdrawal,
    p_admin_id,
    NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
    jsonb_build_object('paid_reference', TRIM(p_paid_reference))
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_rejected_reason text,
  p_admin_note text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.withdrawal_requests%ROWTYPE;
  v_wallet public.mentor_wallets%ROWTYPE;
  v_old_balance integer;
  v_old_pending integer;
  v_reason text := NULLIF(TRIM(COALESCE(p_rejected_reason, '')), '');
  v_actor uuid := auth.uid();
  v_jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu thông tin xử lý yêu cầu rút tiền.';
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Tài khoản xử lý không có quyền Admin.';
  END IF;

  IF v_jwt_role <> 'service_role' AND (v_actor IS NULL OR v_actor <> p_admin_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền xử lý yêu cầu rút tiền này.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Vui lòng nhập lý do từ chối.';
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu rút tiền.';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Yêu cầu này đã được xử lý, không thể xử lý lại.';
  END IF;

  SELECT * INTO v_wallet
  FROM public.mentor_wallets
  WHERE mentor_id = v_request.mentor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ví mentor.';
  END IF;

  IF v_wallet.pending_withdrawal < v_request.amount THEN
    RAISE EXCEPTION 'Số dư rút tiền đang chờ không đủ, vui lòng kiểm tra lại ví mentor.';
  END IF;

  v_old_balance := v_wallet.balance;
  v_old_pending := v_wallet.pending_withdrawal;

  UPDATE public.mentor_wallets
  SET balance = balance + v_request.amount,
      pending_withdrawal = pending_withdrawal - v_request.amount,
      updated_at = now()
  WHERE mentor_id = v_request.mentor_id
  RETURNING * INTO v_wallet;

  UPDATE public.withdrawal_requests
  SET status = 'rejected',
      rejected_reason = v_reason,
      rejection_reason = v_reason,
      processed_by = p_admin_id,
      processed_at = now(),
      admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), ''),
      pending_snapshot = v_wallet.pending_withdrawal,
      balance_snapshot = v_wallet.balance,
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO public.wallet_transactions (
    mentor_id,
    kind,
    description,
    delta,
    balance_after,
    reference_code
  )
  VALUES (
    v_request.mentor_id,
    'refund',
    'Hoàn tiền yêu cầu rút bị từ chối',
    v_request.amount,
    v_wallet.balance,
    v_request.reference_code
  );

  INSERT INTO public.withdrawal_audit_logs (
    withdrawal_request_id,
    mentor_id,
    action,
    amount,
    old_status,
    new_status,
    old_balance,
    new_balance,
    old_pending_withdrawal,
    new_pending_withdrawal,
    performed_by,
    note
  )
  VALUES (
    v_request.id,
    v_request.mentor_id,
    'rejected',
    v_request.amount,
    'pending',
    'rejected',
    v_old_balance,
    v_wallet.balance,
    v_old_pending,
    v_wallet.pending_withdrawal,
    p_admin_id,
    COALESCE(NULLIF(TRIM(COALESCE(p_admin_note, '')), ''), v_reason)
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_reserve_pending_withdrawal(
  p_request_id uuid,
  p_admin_id uuid,
  p_admin_note text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.withdrawal_requests%ROWTYPE;
  v_wallet public.mentor_wallets%ROWTYPE;
  v_old_balance integer;
  v_old_pending integer;
  v_missing_amount integer;
  v_actor uuid := auth.uid();
  v_jwt_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu thông tin sửa khóa tiền.';
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Tài khoản xử lý không có quyền Admin.';
  END IF;

  IF v_jwt_role <> 'service_role' AND (v_actor IS NULL OR v_actor <> p_admin_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa khóa tiền cho yêu cầu này.';
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu rút tiền.';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Chỉ có thể sửa khóa tiền cho yêu cầu đang chờ xử lý.';
  END IF;

  SELECT * INTO v_wallet
  FROM public.mentor_wallets
  WHERE mentor_id = v_request.mentor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy ví mentor.';
  END IF;

  IF v_wallet.pending_withdrawal >= v_request.amount THEN
    UPDATE public.withdrawal_requests
    SET balance_snapshot = v_wallet.balance,
        pending_snapshot = v_wallet.pending_withdrawal,
        updated_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    RETURN v_request;
  END IF;

  v_missing_amount := v_request.amount - v_wallet.pending_withdrawal;

  IF v_wallet.balance < v_missing_amount THEN
    RAISE EXCEPTION 'Số dư khả dụng không đủ để khóa bổ sung cho yêu cầu rút tiền này.';
  END IF;

  v_old_balance := v_wallet.balance;
  v_old_pending := v_wallet.pending_withdrawal;

  UPDATE public.mentor_wallets
  SET balance = balance - v_missing_amount,
      pending_withdrawal = pending_withdrawal + v_missing_amount,
      updated_at = now()
  WHERE mentor_id = v_request.mentor_id
  RETURNING * INTO v_wallet;

  UPDATE public.withdrawal_requests
  SET balance_snapshot = v_wallet.balance,
      pending_snapshot = v_wallet.pending_withdrawal,
      admin_note = COALESCE(NULLIF(TRIM(COALESCE(p_admin_note, '')), ''), admin_note),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO public.withdrawal_audit_logs (
    withdrawal_request_id,
    mentor_id,
    action,
    amount,
    old_status,
    new_status,
    old_balance,
    new_balance,
    old_pending_withdrawal,
    new_pending_withdrawal,
    performed_by,
    note,
    metadata
  )
  VALUES (
    v_request.id,
    v_request.mentor_id,
    'repair_reserved',
    v_missing_amount,
    'pending',
    'pending',
    v_old_balance,
    v_wallet.balance,
    v_old_pending,
    v_wallet.pending_withdrawal,
    p_admin_id,
    COALESCE(NULLIF(TRIM(COALESCE(p_admin_note, '')), ''), 'Admin sửa khóa tiền cho yêu cầu cũ'),
    jsonb_build_object('withdrawal_amount', v_request.amount, 'missing_reserved_amount', v_missing_amount)
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal_request(
  withdrawal_request_id uuid,
  new_status public.withdrawal_status,
  admin_note text DEFAULT NULL,
  processed_reference text DEFAULT NULL
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status = 'paid' THEN
    RETURN public.approve_withdrawal_request(
      withdrawal_request_id,
      (SELECT auth.uid()),
      processed_reference,
      admin_note
    );
  ELSIF new_status = 'rejected' THEN
    RETURN public.reject_withdrawal_request(
      withdrawal_request_id,
      (SELECT auth.uid()),
      admin_note,
      admin_note
    );
  END IF;

  RAISE EXCEPTION 'Trạng thái xử lý không hợp lệ.';
END;
$$;

REVOKE ALL ON FUNCTION public.request_mentor_withdrawal(uuid, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_mentor_withdrawal(integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_withdrawal_request(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_withdrawal_request(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_reserve_pending_withdrawal(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_process_withdrawal_request(uuid, public.withdrawal_status, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_mentor_withdrawal(uuid, integer, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_mentor_withdrawal(integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal_request(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal_request(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_reserve_pending_withdrawal(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal_request(uuid, public.withdrawal_status, text, text) TO authenticated, service_role;
