-- ============================================================
-- EXE201 HK8 - Full Database Schema Migration
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE course_format AS ENUM ('online', 'offline');
CREATE TYPE course_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE booking_status AS ENUM ('pending', 'upcoming', 'completed', 'cancelled', 'declined');
CREATE TYPE payment_method AS ENUM ('later', 'platform', 'credit_card', 'bank_transfer', 'e_wallet');
CREATE TYPE transaction_status AS ENUM ('success', 'refunded', 'pending', 'failed');
CREATE TYPE transaction_type AS ENUM ('online', 'offline', 'product');
CREATE TYPE wallet_txn_kind AS ENUM ('sale', 'withdraw', 'refund');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'paid', 'rejected');
CREATE TYPE report_type AS ENUM ('course', 'mentor', 'comment', 'payment');
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed', 'appealed');
CREATE TYPE promotion_status AS ENUM ('active', 'expired', 'pending');

-- ============================================================
-- COURSES
-- ============================================================

CREATE TABLE courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  format        course_format NOT NULL DEFAULT 'offline',
  price         INTEGER NOT NULL DEFAULT 0,          -- VNĐ per session
  location      TEXT,                                -- địa chỉ nếu offline
  meeting_link  TEXT,                                -- link zoom/meet nếu online
  image_url     TEXT,
  status        course_status NOT NULL DEFAULT 'pending',
  is_promoted   BOOLEAN NOT NULL DEFAULT FALSE,
  students_count INTEGER NOT NULL DEFAULT 0,
  rating        NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lịch dạy của khóa học (nhiều slot / khóa)
CREATE TABLE course_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,   -- 'Thứ 2', 'Thứ 3', ...
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  mentor_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES course_schedules(id) ON DELETE SET NULL,
  booking_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  phone           TEXT,
  payment_method  payment_method NOT NULL DEFAULT 'later',
  status          booking_status NOT NULL DEFAULT 'pending',
  total_price     INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  learner_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, learner_id)   -- mỗi booking chỉ review 1 lần
);

-- ============================================================
-- SAVED COURSES (Wishlist)
-- ============================================================

CREATE TABLE saved_courses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

-- ============================================================
-- TRANSACTIONS (Lịch sử thanh toán của học viên)
-- ============================================================

CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  learner_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  mentor_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
  amount          INTEGER NOT NULL,                  -- tổng tiền học viên trả
  platform_fee    INTEGER NOT NULL DEFAULT 0,        -- phí nền tảng (15%)
  net_amount      INTEGER NOT NULL DEFAULT 0,        -- mentor thực nhận
  payment_method  payment_method NOT NULL DEFAULT 'platform',
  txn_type        transaction_type NOT NULL DEFAULT 'offline',
  status          transaction_status NOT NULL DEFAULT 'success',
  reference_code  TEXT UNIQUE,                       -- mã giao dịch TXN-xxxx
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MENTOR WALLETS
-- ============================================================

CREATE TABLE mentor_wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id     UUID NOT NULL UNIQUE REFERENCES profiles(user_id) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0,          -- số dư khả dụng (VNĐ)
  held_balance  INTEGER NOT NULL DEFAULT 0,          -- đang tạm giữ (< 7 ngày)
  total_earned  INTEGER NOT NULL DEFAULT 0,          -- tổng đã kiếm
  bank_name     TEXT,
  bank_account  TEXT,
  bank_holder   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lịch sử giao dịch ví mentor
CREATE TABLE wallet_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind         wallet_txn_kind NOT NULL,
  description  TEXT NOT NULL,
  delta        INTEGER NOT NULL,                     -- dương = cộng, âm = trừ
  balance_after INTEGER NOT NULL,
  reference_code TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WITHDRAWAL REQUESTS (Yêu cầu rút tiền)
-- ============================================================

CREATE TABLE withdrawal_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  bank_name    TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  bank_holder  TEXT NOT NULL,
  status       withdrawal_status NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROMOTED LISTINGS (Tin nổi bật)
-- ============================================================

CREATE TABLE promoted_listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  mentor_id   UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  fee         INTEGER NOT NULL DEFAULT 15000,        -- phí quảng cáo (VNĐ)
  days        INTEGER NOT NULL DEFAULT 3,
  status      promotion_status NOT NULL DEFAULT 'pending',
  starts_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REPORTS (Báo cáo vi phạm)
-- ============================================================

CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           report_type NOT NULL,
  title          TEXT NOT NULL,
  reason         TEXT NOT NULL,
  detail         TEXT,
  reporter_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  course_id      UUID REFERENCES courses(id) ON DELETE SET NULL,
  status         report_status NOT NULL DEFAULT 'pending',
  admin_verdict  TEXT,
  admin_email    TEXT,                               -- nội dung email gửi mentor
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MENTOR STRIKES (Gậy phạt)
-- ============================================================

CREATE TABLE mentor_strikes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  report_id   UUID REFERENCES reports(id) ON DELETE SET NULL,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  reason      TEXT NOT NULL,
  expires_at  TIMESTAMPTZ,                           -- NULL = vĩnh viễn (level 3)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Tối ưu query)
-- ============================================================

CREATE INDEX idx_courses_mentor_id    ON courses(mentor_id);
CREATE INDEX idx_courses_category     ON courses(category);
CREATE INDEX idx_courses_status       ON courses(status);
CREATE INDEX idx_courses_format       ON courses(format);

CREATE INDEX idx_bookings_learner_id  ON bookings(learner_id);
CREATE INDEX idx_bookings_mentor_id   ON bookings(mentor_id);
CREATE INDEX idx_bookings_course_id   ON bookings(course_id);
CREATE INDEX idx_bookings_status      ON bookings(status);

CREATE INDEX idx_reviews_course_id    ON reviews(course_id);
CREATE INDEX idx_reviews_learner_id   ON reviews(learner_id);

CREATE INDEX idx_transactions_learner ON transactions(learner_id);
CREATE INDEX idx_transactions_mentor  ON transactions(mentor_id);

CREATE INDEX idx_wallet_txns_mentor   ON wallet_transactions(mentor_id);
CREATE INDEX idx_reports_status       ON reports(status);
CREATE INDEX idx_reports_reporter     ON reports(reporter_id);

-- ============================================================
-- TRIGGERS: auto update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: Tự động tạo ví khi mentor đăng ký
-- ============================================================

CREATE OR REPLACE FUNCTION create_mentor_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'mentor' THEN
    INSERT INTO mentor_wallets (mentor_id)
    VALUES (NEW.user_id)
    ON CONFLICT (mentor_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_mentor_wallet
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_mentor_wallet();

-- ============================================================
-- TRIGGER: Cập nhật rating khóa học khi có review mới
-- ============================================================

CREATE OR REPLACE FUNCTION update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews
      WHERE course_id = NEW.course_id
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE course_id = NEW.course_id
    )
  WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_course_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_course_rating();

-- ============================================================
-- TRIGGER: Cập nhật students_count khi booking completed
-- ============================================================

CREATE OR REPLACE FUNCTION update_students_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE courses
    SET students_count = students_count + 1
    WHERE id = NEW.course_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_students_count
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_students_count();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_wallets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoted_listings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_strikes       ENABLE ROW LEVEL SECURITY;

-- ---- COURSES ----
-- Ai cũng xem được khóa học đã approved
CREATE POLICY "courses_public_read" ON courses
  FOR SELECT USING (status = 'approved');

-- Mentor chỉ xem được khóa học của mình (kể cả pending/rejected)
CREATE POLICY "courses_mentor_own" ON courses
  FOR ALL USING (mentor_id = auth.uid());

-- Admin xem tất cả
CREATE POLICY "courses_admin_all" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- COURSE SCHEDULES ----
CREATE POLICY "schedules_public_read" ON course_schedules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND status = 'approved')
  );

CREATE POLICY "schedules_mentor_manage" ON course_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND mentor_id = auth.uid())
  );

-- ---- BOOKINGS ----
CREATE POLICY "bookings_learner_own" ON bookings
  FOR ALL USING (learner_id = auth.uid());

CREATE POLICY "bookings_mentor_own" ON bookings
  FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "bookings_mentor_update" ON bookings
  FOR UPDATE USING (mentor_id = auth.uid());

CREATE POLICY "bookings_admin_all" ON bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- REVIEWS ----
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (TRUE);

CREATE POLICY "reviews_learner_insert" ON reviews
  FOR INSERT WITH CHECK (learner_id = auth.uid());

CREATE POLICY "reviews_learner_update" ON reviews
  FOR UPDATE USING (learner_id = auth.uid());

-- ---- SAVED COURSES ----
CREATE POLICY "saved_courses_own" ON saved_courses
  FOR ALL USING (user_id = auth.uid());

-- ---- TRANSACTIONS ----
CREATE POLICY "transactions_learner_read" ON transactions
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "transactions_mentor_read" ON transactions
  FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "transactions_admin_all" ON transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- MENTOR WALLETS ----
CREATE POLICY "wallet_mentor_own" ON mentor_wallets
  FOR ALL USING (mentor_id = auth.uid());

CREATE POLICY "wallet_admin_all" ON mentor_wallets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- WALLET TRANSACTIONS ----
CREATE POLICY "wallet_txns_mentor_own" ON wallet_transactions
  FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "wallet_txns_admin_all" ON wallet_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- WITHDRAWAL REQUESTS ----
CREATE POLICY "withdrawal_mentor_own" ON withdrawal_requests
  FOR ALL USING (mentor_id = auth.uid());

CREATE POLICY "withdrawal_admin_all" ON withdrawal_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- PROMOTED LISTINGS ----
CREATE POLICY "promoted_public_read" ON promoted_listings
  FOR SELECT USING (status = 'active');

CREATE POLICY "promoted_mentor_own" ON promoted_listings
  FOR ALL USING (mentor_id = auth.uid());

CREATE POLICY "promoted_admin_all" ON promoted_listings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- REPORTS ----
CREATE POLICY "reports_reporter_own" ON reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports_reporter_read" ON reports
  FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "reports_admin_all" ON reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---- MENTOR STRIKES ----
CREATE POLICY "strikes_mentor_read" ON mentor_strikes
  FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "strikes_admin_all" ON mentor_strikes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
