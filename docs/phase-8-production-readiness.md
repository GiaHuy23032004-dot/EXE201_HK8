# Phase 8 - Production Readiness Checklist

Tai lieu nay dung de kiem tra lan cuoi truoc demo/production trial cho VET Plus, AI features va payment flow. Khong dua secret vao repo, frontend hoac slide demo.

## 1. Environment & Secrets

### Bat buoc cho Supabase va Edge Functions

- [ ] `SUPABASE_URL` da cau hinh cho Edge Functions.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` chi nam trong Supabase Edge Function secrets, khong xuat hien o frontend.
- [ ] Frontend chi dung public Supabase URL va anon/publishable key neu can.
- [ ] Khong co secret nao nam trong source code, file docs demo, screenshot, browser console hoac client bundle.

### Bat buoc cho AI

- [ ] `GEMINI_API_KEY` da cau hinh trong Edge Function secrets.
- [ ] `AI_PROVIDER` da cau hinh va khop provider hien tai.
- [ ] `GEMINI_MODEL_FAST` da cau hinh cho tac vu nhe/nhanh.
- [ ] `GEMINI_MODEL_MAIN` da cau hinh cho tac vu chinh nhu compare/roadmap.
- [ ] `AI_MAX_OUTPUT_TOKENS` da cau hinh neu provider wrapper dang doc bien nay.
- [ ] API key AI khong bao gio duoc goi tu frontend.
- [ ] AI credit gating van di qua `reserve_ai_usage` va `finalize_ai_usage`.

### Bat buoc cho SePay / payment

- [ ] Cac bien `SEPAY_*` can thiet da cau hinh trong Edge Function secrets.
- [ ] `SEPAY_WEBHOOK_API_KEY` da cau hinh va webhook test dung header/token mong doi.
- [ ] Khong co payment provider secret nao nam trong frontend.
- [ ] Khong hard-code API key, bank secret, webhook token hoac service role key.

## 2. Edge Functions Can Deploy

- [ ] `ai-chat`
- [ ] `ai-search`
- [ ] `ai-advisor`
- [ ] `ai-compare`
- [ ] `ai-roadmap`
- [ ] `create-subscription-payment`
- [ ] `sepay-webhook`
- [ ] `admin-subscriptions`

Ghi chu: neu vua sua AI Learning Profile/AI History integration, can deploy lai `ai-search`, `ai-advisor`, `ai-compare`, `ai-roadmap`.

## 3. Database / RPC Can Ton Tai

### Tables

- [ ] `subscription_plans`
- [ ] `learner_subscriptions`
- [ ] `subscription_payments`
- [ ] `subscription_vouchers`
- [ ] `ai_usage_logs`
- [ ] `learner_learning_profiles`
- [ ] `payment_webhook_events`

### RPC

- [ ] `get_my_subscription`
- [ ] `reserve_ai_usage`
- [ ] `finalize_ai_usage`
- [ ] `get_my_ai_history`
- [ ] `get_my_learning_profile`
- [ ] `upsert_my_learning_profile`
- [ ] `complete_subscription_payment`

## 4. Billing Note

- [ ] Gemini billing chua can bat cho demo/internal testing neu quota free/internal van du.
- [ ] Can bat billing truoc public beta hoac truoc khi cho user tra tien that.
- [ ] Khi bat billing, dat Project Spend Cap ban dau khoang 10-20 USD/thang.
- [ ] Log token usage vao `ai_usage_logs.metadata` gom provider, model, input/output/total tokens neu provider tra ve.
- [ ] Theo doi cac AI feature ton credit cao hon nhu `compare` va `roadmap`.

## 5. Security & Access

- [ ] Admin authorization chi dua vao `public.user_roles.role = 'admin'`.
- [ ] Khong dung `profiles.role = 'admin'`.
- [ ] Learner chi xem duoc subscription, voucher, AI history va learning profile cua chinh minh.
- [ ] Mentor/admin khong duoc thay AI prompt/history rieng cua learner neu khong co flow admin duoc thiet ke rieng.
- [ ] Webhook co idempotency va log vao `payment_webhook_events`.
- [ ] Direct frontend khong insert/update vao bang tien nhay cam nhu `transactions`, `mentor_wallets`, `learner_subscriptions` hoac `subscription_payments` tru khi flow da duoc RLS/Edge Function cho phep ro rang.

## 6. Final Demo Readiness

- [ ] `npx tsc --noEmit` pass.
- [ ] `npm run build` pass.
- [ ] Demo learner Free co credit AI.
- [ ] Demo learner Plus co 60 credit va 2 voucher.
- [ ] Demo webhook VETSUB success kich hoat Plus.
- [ ] Demo Admin Subscription Dashboard doc du lieu payment/webhook/subscription.
- [ ] Demo AI History hien log sau khi goi AI.
- [ ] Demo Learning Profile luu duoc va AI functions doc context ngan.
- [ ] Regression marketplace, booking, mentor dashboard, mentor wallet va admin pages van load.

