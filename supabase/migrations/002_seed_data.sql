-- ============================================================
-- SEED DATA - Dữ liệu mẫu
-- Chạy file này trong Supabase SQL Editor SAU khi chạy 001
-- ============================================================

-- Tắt trigger kiểm tra foreign key tạm thời để insert seed data
SET session_replication_role = replica;

-- ============================================================
-- INSERT vào auth.users trước (bắt buộc vì profiles FK tới auth.users)
-- ============================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role, aud
) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'minhtuan@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Minh Tuấn"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'thuha@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Thu Hà"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'ducanh@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Đức Anh"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'linhchi@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Linh Chi"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'hungpt@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Hùng PT"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'yuki@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Yuki Nguyễn"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
   'hoanglong@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Hoàng Long"}', false, 'authenticated', 'authenticated'),

  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
   'maianh@example.com', crypt('Password123!', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mai Anh"}', false, 'authenticated', 'authenticated')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT PROFILES
-- ============================================================

INSERT INTO profiles (user_id, name, username, email, phone, bio, role, avatar_url) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Minh Tuấn',    'minhtuan',   'minhtuan@example.com',  '0901111111', '10 năm kinh nghiệm giảng dạy guitar. Tốt nghiệp Nhạc viện TP.HCM.',                    'mentor', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000002', 'Thu Hà',       'thuha',      'thuha@example.com',     '0902222222', 'IELTS 8.5, giảng viên đại học 8 năm kinh nghiệm.',                                     'mentor', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000003', 'Đức Anh',      'ducanh',     'ducanh@example.com',    '0903333333', 'Senior Developer tại công ty công nghệ lớn. 7 năm kinh nghiệm React/Node.js.',          'mentor', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000004', 'Linh Chi',     'linhchi',    'linhchi@example.com',   '0904444444', 'Chứng chỉ RYT-500. 5 năm giảng dạy Yoga và Thiền.',                                    'mentor', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000005', 'Hùng PT',      'hungpt',     'hungpt@example.com',    '0905555555', 'HLV cá nhân chuyên nghiệp. Chứng chỉ ACE Personal Trainer.',                           'mentor', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000006', 'Yuki Nguyễn',  'yukinuyen',  'yuki@example.com',      '0906666666', 'Đầu bếp từng tu nghiệp tại Tokyo 3 năm. Chuyên ẩm thực Nhật Bản.',                     'mentor', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000007', 'Hoàng Long',   'hoanglong',  'hoanglong@example.com', '0907777777', 'Giáo viên Piano cổ điển. Tốt nghiệp Nhạc viện Hà Nội.',                                'mentor', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'),
  ('00000000-0000-0000-0000-000000000008', 'Mai Anh',      'maianh',     'maianh@example.com',    '0908888888', 'Họa sĩ chuyên nghiệp. Triển lãm tại Hà Nội và TP.HCM.',                                'mentor', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- INSERT COURSES
-- ============================================================

INSERT INTO courses (id, mentor_id, title, description, category, format, price, location, image_url, status, is_promoted, students_count, rating, review_count) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Guitar Acoustic cho người mới bắt đầu',
   'Khóa học được thiết kế dành cho người mới bắt đầu học guitar. Bạn sẽ học từ cách cầm đàn, các hợp âm cơ bản đến chơi được những bài nhạc yêu thích.',
   'music', 'offline', 200000, 'Quận 1, TP.HCM',
   'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=400&fit=crop',
   'approved', true, 340, 4.9, 128),

  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   'Tiếng Anh giao tiếp IELTS 6.5+',
   'Khóa học luyện thi IELTS từ 6.5 trở lên. Tập trung vào 4 kỹ năng Nghe, Nói, Đọc, Viết với phương pháp thực chiến.',
   'language', 'online', 350000, NULL,
   'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop',
   'approved', false, 890, 4.8, 256),

  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
   'Yoga & Thiền - Cân bằng cuộc sống',
   'Khóa học Yoga và Thiền dành cho người muốn cân bằng thể chất và tinh thần. Phù hợp mọi lứa tuổi.',
   'fitness', 'offline', 180000, 'Quận 7, TP.HCM',
   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop',
   'approved', false, 210, 4.7, 89),

  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003',
   'Lập trình Web Fullstack với React',
   'Khóa học lập trình Web Fullstack từ cơ bản đến nâng cao với React, Node.js, và PostgreSQL.',
   'coding', 'online', 500000, NULL,
   'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop',
   'approved', true, 1200, 4.9, 312),

  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006',
   'Nấu ăn Nhật Bản - Sushi & Ramen',
   'Học cách làm Sushi và Ramen chuẩn vị Nhật Bản tại nhà.',
   'cooking', 'offline', 300000, 'Quận 3, TP.HCM',
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop',
   'approved', false, 150, 4.6, 67),

  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005',
   'Fitness & Gym cơ bản tại nhà',
   'Khóa học tập gym tại nhà không cần dụng cụ.',
   'fitness', 'online', 250000, NULL,
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
   'approved', false, 560, 4.8, 198),

  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008',
   'Vẽ tranh sơn dầu nghệ thuật',
   'Khóa học vẽ tranh sơn dầu từ cơ bản đến nâng cao.',
   'art', 'offline', 280000, 'Quận Bình Thạnh, TP.HCM',
   'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=400&fit=crop',
   'approved', false, 90, 4.5, 45),

  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000007',
   'Piano cổ điển từ cơ bản đến nâng cao',
   'Khóa học Piano cổ điển bài bản theo giáo trình quốc tế.',
   'music', 'offline', 400000, 'Quận 2, TP.HCM',
   'https://images.unsplash.com/photo-1460518451285-97b6aa326961?w=600&h=400&fit=crop',
   'approved', true, 430, 4.9, 175)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT COURSE SCHEDULES
-- ============================================================

INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Thứ 2', '09:00', '11:00'),
  ('10000000-0000-0000-0000-000000000001', 'Thứ 4', '09:00', '11:00'),
  ('10000000-0000-0000-0000-000000000001', 'Thứ 6', '14:00', '16:00'),
  ('10000000-0000-0000-0000-000000000001', 'Thứ 7', '08:00', '10:00'),
  ('10000000-0000-0000-0000-000000000002', 'Thứ 3', '19:00', '21:00'),
  ('10000000-0000-0000-0000-000000000002', 'Thứ 5', '19:00', '21:00'),
  ('10000000-0000-0000-0000-000000000002', 'Thứ 7', '09:00', '11:00'),
  ('10000000-0000-0000-0000-000000000003', 'Thứ 2', '06:00', '07:30'),
  ('10000000-0000-0000-0000-000000000003', 'Thứ 4', '06:00', '07:30'),
  ('10000000-0000-0000-0000-000000000003', 'Thứ 6', '06:00', '07:30'),
  ('10000000-0000-0000-0000-000000000004', 'Thứ 3', '20:00', '22:00'),
  ('10000000-0000-0000-0000-000000000004', 'Thứ 5', '20:00', '22:00'),
  ('10000000-0000-0000-0000-000000000004', 'Chủ nhật', '09:00', '12:00'),
  ('10000000-0000-0000-0000-000000000005', 'Thứ 7', '14:00', '17:00'),
  ('10000000-0000-0000-0000-000000000005', 'Chủ nhật', '09:00', '12:00'),
  ('10000000-0000-0000-0000-000000000006', 'Thứ 2', '07:00', '08:00'),
  ('10000000-0000-0000-0000-000000000006', 'Thứ 4', '07:00', '08:00'),
  ('10000000-0000-0000-0000-000000000006', 'Thứ 6', '07:00', '08:00'),
  ('10000000-0000-0000-0000-000000000007', 'Thứ 7', '09:00', '12:00'),
  ('10000000-0000-0000-0000-000000000007', 'Chủ nhật', '14:00', '17:00'),
  ('10000000-0000-0000-0000-000000000008', 'Thứ 3', '17:00', '19:00'),
  ('10000000-0000-0000-0000-000000000008', 'Thứ 5', '17:00', '19:00'),
  ('10000000-0000-0000-0000-000000000008', 'Thứ 7', '10:00', '12:00');

-- ============================================================
-- INSERT MENTOR WALLETS
-- ============================================================

INSERT INTO mentor_wallets (mentor_id, balance, held_balance, total_earned, bank_name, bank_account, bank_holder) VALUES
  ('00000000-0000-0000-0000-000000000001', 3855000,  595000, 12400000, 'Vietcombank', '0123456789',  'NGUYEN MINH TUAN'),
  ('00000000-0000-0000-0000-000000000002', 5200000,  297500, 18900000, 'Techcombank', '9988776655',  'TRAN THU HA'),
  ('00000000-0000-0000-0000-000000000003', 8100000,  850000, 32000000, 'BIDV',        '1122334455',  'NGUYEN DUC ANH'),
  ('00000000-0000-0000-0000-000000000004', 1200000,  153000,  4500000, 'Vietinbank',  '5544332211',  'NGUYEN LINH CHI'),
  ('00000000-0000-0000-0000-000000000005', 2400000,  212500,  8700000, 'MB Bank',     '6677889900',  'TRAN HUNG'),
  ('00000000-0000-0000-0000-000000000006',  900000,  255000,  3200000, 'ACB',         '1234567890',  'NGUYEN THI YUKI'),
  ('00000000-0000-0000-0000-000000000007', 3600000,  340000, 14200000, 'Vietcombank', '0987654321',  'HOANG VAN LONG'),
  ('00000000-0000-0000-0000-000000000008',  750000,  238000,  2800000, 'Sacombank',   '1357924680',  'NGUYEN THI MAI ANH')
ON CONFLICT (mentor_id) DO NOTHING;

-- Bật lại chế độ bình thường
SET session_replication_role = DEFAULT;

SELECT 'Seed data inserted successfully! 8 mentors, 8 courses, 23 schedules.' AS result;
