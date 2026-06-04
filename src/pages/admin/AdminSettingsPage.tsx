import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileWarning,
  Globe2,
  Loader2,
  Save,
  Activity,
  Settings,
  Shield,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { NumberSettingInput } from "@/components/admin/settings/NumberSettingInput";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminSettings,
  useSystemHealth,
  useUpdateAdminSettings,
  type SettingsKey,
  type SystemSetting,
} from "@/hooks/useAdminSettings";

type AccessSecuritySettings = {
  prevent_last_admin_removal: boolean;
  prevent_admin_self_block: boolean;
  require_admin_check_edge_function: boolean;
};

type ModerationReportsSettings = {
  report_detail_min_length: number;
  report_detail_max_length: number;
  report_title_max_length: number;
  report_reason_max_length: number;
  evidence_max_files: number;
  evidence_max_file_mb: number;
  auto_hide_report_threshold: number;
  appeal_window_days: number;
  strike_1_expire_days: number;
  strike_2_expire_days: number;
  strike_2_posting_suspension_days: number;
  strike_3_permanent: boolean;
};

type MentorVerificationSettings = {
  allow_mentor_create_draft_before_verified: boolean;
  allow_mentor_publish_before_verified: boolean;
  allow_mentor_receive_booking_before_verified: boolean;
  require_avatar_upload: boolean;
  require_at_least_one_evidence: boolean;
  accepted_evidence_types: string[];
  show_vet_verified_badge: boolean;
  show_certificate_verified_badge: boolean;
  show_portfolio_verified_badge: boolean;
  show_trusted_mentor_badge: boolean;
  strike_1_suspend_trusted_badge_days: number;
  strike_2_suspend_trusted_badge: boolean;
  strike_3_revoke_trusted_badge: boolean;
  revoke_vet_verified_only_for_fraud: boolean;
};

type MarketplaceRulesSettings = {
  public_only_show_approved_courses: boolean;
  public_hide_hidden_courses: boolean;
  allow_online_courses: boolean;
  allow_offline_courses: boolean;
  promoted_listing_default_days: number;
  promoted_listing_default_fee: number;
  minimum_course_price: number;
  maximum_course_price: number | null;
};

const ACCESS_DEFAULTS: AccessSecuritySettings = {
  prevent_last_admin_removal: true,
  prevent_admin_self_block: true,
  require_admin_check_edge_function: true,
};

const MODERATION_DEFAULTS: ModerationReportsSettings = {
  report_detail_min_length: 20,
  report_detail_max_length: 1200,
  report_title_max_length: 120,
  report_reason_max_length: 160,
  evidence_max_files: 5,
  evidence_max_file_mb: 5,
  auto_hide_report_threshold: 5,
  appeal_window_days: 7,
  strike_1_expire_days: 30,
  strike_2_expire_days: 90,
  strike_2_posting_suspension_days: 7,
  strike_3_permanent: true,
};

const VERIFICATION_DEFAULTS: MentorVerificationSettings = {
  allow_mentor_create_draft_before_verified: true,
  allow_mentor_publish_before_verified: false,
  allow_mentor_receive_booking_before_verified: false,
  require_avatar_upload: true,
  require_at_least_one_evidence: true,
  accepted_evidence_types: ["social_link", "certificate", "cv_portfolio"],
  show_vet_verified_badge: true,
  show_certificate_verified_badge: true,
  show_portfolio_verified_badge: true,
  show_trusted_mentor_badge: true,
  strike_1_suspend_trusted_badge_days: 0,
  strike_2_suspend_trusted_badge: true,
  strike_3_revoke_trusted_badge: true,
  revoke_vet_verified_only_for_fraud: true,
};

const MARKETPLACE_DEFAULTS: MarketplaceRulesSettings = {
  public_only_show_approved_courses: true,
  public_hide_hidden_courses: true,
  allow_online_courses: true,
  allow_offline_courses: true,
  promoted_listing_default_days: 3,
  promoted_listing_default_fee: 15000,
  minimum_course_price: 0,
  maximum_course_price: null,
};

const EVIDENCE_TYPES = [
  { value: "social_link", label: "Mạng xã hội nghề nghiệp" },
  { value: "certificate", label: "Chứng chỉ / bằng cấp" },
  { value: "cv_portfolio", label: "CV / Portfolio" },
];

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const boolValue = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const numberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function settingsByKey(settings?: SystemSetting[]) {
  return new Map((settings ?? []).map((setting) => [setting.key, setting]));
}

function parseAccess(setting?: SystemSetting): AccessSecuritySettings {
  const value = asRecord(setting?.value);
  return {
    prevent_last_admin_removal: boolValue(value.prevent_last_admin_removal, ACCESS_DEFAULTS.prevent_last_admin_removal),
    prevent_admin_self_block: boolValue(value.prevent_admin_self_block, ACCESS_DEFAULTS.prevent_admin_self_block),
    require_admin_check_edge_function: boolValue(value.require_admin_check_edge_function, ACCESS_DEFAULTS.require_admin_check_edge_function),
  };
}

function parseModeration(setting?: SystemSetting): ModerationReportsSettings {
  const value = asRecord(setting?.value);
  return {
    report_detail_min_length: numberValue(value.report_detail_min_length, MODERATION_DEFAULTS.report_detail_min_length),
    report_detail_max_length: numberValue(value.report_detail_max_length, MODERATION_DEFAULTS.report_detail_max_length),
    report_title_max_length: numberValue(value.report_title_max_length, MODERATION_DEFAULTS.report_title_max_length),
    report_reason_max_length: numberValue(value.report_reason_max_length, MODERATION_DEFAULTS.report_reason_max_length),
    evidence_max_files: numberValue(value.evidence_max_files, MODERATION_DEFAULTS.evidence_max_files),
    evidence_max_file_mb: numberValue(value.evidence_max_file_mb, MODERATION_DEFAULTS.evidence_max_file_mb),
    auto_hide_report_threshold: numberValue(value.auto_hide_report_threshold, MODERATION_DEFAULTS.auto_hide_report_threshold),
    appeal_window_days: numberValue(value.appeal_window_days, MODERATION_DEFAULTS.appeal_window_days),
    strike_1_expire_days: numberValue(value.strike_1_expire_days, MODERATION_DEFAULTS.strike_1_expire_days),
    strike_2_expire_days: numberValue(value.strike_2_expire_days, MODERATION_DEFAULTS.strike_2_expire_days),
    strike_2_posting_suspension_days: numberValue(value.strike_2_posting_suspension_days, MODERATION_DEFAULTS.strike_2_posting_suspension_days),
    strike_3_permanent: boolValue(value.strike_3_permanent, MODERATION_DEFAULTS.strike_3_permanent),
  };
}

function parseVerification(setting?: SystemSetting): MentorVerificationSettings {
  const value = asRecord(setting?.value);
  const evidenceTypes = Array.isArray(value.accepted_evidence_types)
    ? value.accepted_evidence_types.filter((item): item is string => typeof item === "string")
    : VERIFICATION_DEFAULTS.accepted_evidence_types;

  return {
    allow_mentor_create_draft_before_verified: boolValue(value.allow_mentor_create_draft_before_verified, true),
    allow_mentor_publish_before_verified: boolValue(value.allow_mentor_publish_before_verified, false),
    allow_mentor_receive_booking_before_verified: boolValue(value.allow_mentor_receive_booking_before_verified, false),
    require_avatar_upload: boolValue(value.require_avatar_upload, true),
    require_at_least_one_evidence: boolValue(value.require_at_least_one_evidence, true),
    accepted_evidence_types: evidenceTypes.length > 0 ? evidenceTypes : VERIFICATION_DEFAULTS.accepted_evidence_types,
    show_vet_verified_badge: boolValue(value.show_vet_verified_badge, true),
    show_certificate_verified_badge: boolValue(value.show_certificate_verified_badge, true),
    show_portfolio_verified_badge: boolValue(value.show_portfolio_verified_badge, true),
    show_trusted_mentor_badge: boolValue(value.show_trusted_mentor_badge, true),
    strike_1_suspend_trusted_badge_days: numberValue(value.strike_1_suspend_trusted_badge_days, 0),
    strike_2_suspend_trusted_badge: boolValue(value.strike_2_suspend_trusted_badge, true),
    strike_3_revoke_trusted_badge: boolValue(value.strike_3_revoke_trusted_badge, true),
    revoke_vet_verified_only_for_fraud: boolValue(value.revoke_vet_verified_only_for_fraud, true),
  };
}

function parseMarketplace(setting?: SystemSetting): MarketplaceRulesSettings {
  const value = asRecord(setting?.value);
  return {
    public_only_show_approved_courses: boolValue(value.public_only_show_approved_courses, true),
    public_hide_hidden_courses: boolValue(value.public_hide_hidden_courses, true),
    allow_online_courses: boolValue(value.allow_online_courses, true),
    allow_offline_courses: boolValue(value.allow_offline_courses, true),
    promoted_listing_default_days: numberValue(value.promoted_listing_default_days, 3),
    promoted_listing_default_fee: numberValue(value.promoted_listing_default_fee, 15000),
    minimum_course_price: numberValue(value.minimum_course_price, 0),
    maximum_course_price: value.maximum_course_price === null || value.maximum_course_price === undefined
      ? null
      : numberValue(value.maximum_course_price, 0),
  };
}

function getPaymentValue(setting?: SystemSetting) {
  const value = asRecord(setting?.value);
  return {
    payment_provider_status: String(value.payment_provider_status ?? "planning"),
    current_provider: String(value.current_provider ?? "mock / not configured"),
    platform_fee_rate: numberValue(value.platform_fee_rate, 0.15),
    hold_period: String(value.hold_period ?? "Chưa chốt"),
    webhook_status: String(value.webhook_status ?? "Chưa cấu hình"),
    learner_payment_flow_status: String(value.learner_payment_flow_status ?? "Đang lên kế hoạch"),
    mentor_withdrawal_status: String(value.mentor_withdrawal_status ?? "Giải quyết sau"),
  };
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  onSave,
  isSaving,
  disabled,
  dirty,
  hasErrors,
}: {
  title: string;
  description: string;
  icon: typeof Shield;
  children: ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  dirty?: boolean;
  hasErrors?: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{title}</CardTitle>
                {dirty && <Badge variant="outline" className="rounded-full border-warning/30 bg-warning/10 text-warning">Có thay đổi</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {false && onSave && (
            <Button
              onClick={onSave}
              disabled={disabled || isSaving}
              className="rounded-xl border-0 gradient-primary text-primary-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        {onSave && (
          <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {hasErrors ? "Vui lòng sửa lỗi trước khi lưu." : dirty ? "Các thay đổi sẽ được ghi vào audit log." : "Không có thay đổi."}
            </p>
            <Button
              onClick={onSave}
              disabled={disabled || isSaving || hasErrors || !dirty}
              className="rounded-xl border-0 gradient-primary text-primary-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? "Đang lưu..." : dirty ? "Lưu thay đổi" : "Không có thay đổi"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border bg-background p-4">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  disabled,
  min,
  max,
  step,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}) {
  return (
    <NumberSettingInput
      label={label}
      value={value}
      onChange={onChange}
      suffix={suffix}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      error={error}
    />
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể lưu cài đặt.";
}

type ValidationErrors = Record<string, string>;

function isDirty(current: unknown, saved: unknown) {
  return JSON.stringify(current) !== JSON.stringify(saved);
}

function validateRange(errors: ValidationErrors, key: string, value: number | null, min: number, max: number, label: string) {
  if (value === null || !Number.isFinite(value)) {
    errors[key] = `${label} là bắt buộc.`;
    return;
  }
  if (value < min || value > max) {
    errors[key] = `${label} phải từ ${min} đến ${max}.`;
  }
}

function validateModeration(value: ModerationReportsSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  validateRange(errors, "report_detail_min_length", value.report_detail_min_length, 10, 3000, "Nội dung tối thiểu");
  validateRange(errors, "report_detail_max_length", value.report_detail_max_length, 100, 3000, "Nội dung tối đa");
  if (value.report_detail_max_length <= value.report_detail_min_length) {
    errors.report_detail_max_length = "Nội dung tối đa phải lớn hơn nội dung tối thiểu.";
  }
  validateRange(errors, "report_title_max_length", value.report_title_max_length, 20, 200, "Tiêu đề tối đa");
  validateRange(errors, "report_reason_max_length", value.report_reason_max_length, 20, 300, "Lý do tối đa");
  validateRange(errors, "evidence_max_files", value.evidence_max_files, 1, 10, "Số file bằng chứng");
  validateRange(errors, "evidence_max_file_mb", value.evidence_max_file_mb, 1, 20, "Dung lượng mỗi file");
  validateRange(errors, "auto_hide_report_threshold", value.auto_hide_report_threshold, 3, 20, "Ngưỡng tự động ẩn");
  validateRange(errors, "appeal_window_days", value.appeal_window_days, 1, 30, "Thời hạn kháng cáo");
  validateRange(errors, "strike_1_expire_days", value.strike_1_expire_days, 1, 365, "Gậy 1 hết hạn");
  validateRange(errors, "strike_2_expire_days", value.strike_2_expire_days, 1, 365, "Gậy 2 hết hạn");
  validateRange(errors, "strike_2_posting_suspension_days", value.strike_2_posting_suspension_days, 1, 90, "Cấm đăng sau gậy 2");
  return errors;
}

function validateVerification(value: MentorVerificationSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  validateRange(errors, "strike_1_suspend_trusted_badge_days", value.strike_1_suspend_trusted_badge_days, 0, 365, "Tạm dừng trusted badge sau gậy 1");
  if (value.accepted_evidence_types.length === 0) {
    errors.accepted_evidence_types = "Cần chọn ít nhất một loại bằng chứng.";
  }
  return errors;
}

function validateMarketplace(value: MarketplaceRulesSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  validateRange(errors, "promoted_listing_default_days", value.promoted_listing_default_days, 1, 30, "Số ngày quảng cáo mặc định");
  if (value.promoted_listing_default_fee < 0) {
    errors.promoted_listing_default_fee = "Phí quảng cáo không được âm.";
  }
  if (value.minimum_course_price < 0) {
    errors.minimum_course_price = "Giá tối thiểu không được âm.";
  }
  if (value.maximum_course_price !== null && value.maximum_course_price <= value.minimum_course_price) {
    errors.maximum_course_price = "Giá tối đa phải lớn hơn giá tối thiểu.";
  }
  return errors;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const settingsQuery = useAdminSettings();
  const healthQuery = useSystemHealth();
  const updateSettings = useUpdateAdminSettings();

  const settingMap = useMemo(() => settingsByKey(settingsQuery.data?.settings), [settingsQuery.data?.settings]);
  const [access, setAccess] = useState<AccessSecuritySettings>(ACCESS_DEFAULTS);
  const [moderation, setModeration] = useState<ModerationReportsSettings>(MODERATION_DEFAULTS);
  const [verification, setVerification] = useState<MentorVerificationSettings>(VERIFICATION_DEFAULTS);
  const [marketplace, setMarketplace] = useState<MarketplaceRulesSettings>(MARKETPLACE_DEFAULTS);

  const savedAccess = useMemo(() => parseAccess(settingMap.get("access_security")), [settingMap]);
  const savedModeration = useMemo(() => parseModeration(settingMap.get("moderation_reports")), [settingMap]);
  const savedVerification = useMemo(() => parseVerification(settingMap.get("mentor_verification")), [settingMap]);
  const savedMarketplace = useMemo(() => parseMarketplace(settingMap.get("marketplace_rules")), [settingMap]);

  const moderationErrors = useMemo(() => validateModeration(moderation), [moderation]);
  const verificationErrors = useMemo(() => validateVerification(verification), [verification]);
  const marketplaceErrors = useMemo(() => validateMarketplace(marketplace), [marketplace]);

  const accessDirty = isDirty(access, savedAccess);
  const moderationDirty = isDirty(moderation, savedModeration);
  const verificationDirty = isDirty(verification, savedVerification);
  const marketplaceDirty = isDirty(marketplace, savedMarketplace);

  const savingKey = updateSettings.isPending ? updateSettings.variables?.key : null;

  useEffect(() => {
    if (!settingsQuery.data?.settings) return;
    setAccess(parseAccess(settingMap.get("access_security")));
    setModeration(parseModeration(settingMap.get("moderation_reports")));
    setVerification(parseVerification(settingMap.get("mentor_verification")));
    setMarketplace(parseMarketplace(settingMap.get("marketplace_rules")));
  }, [settingsQuery.data?.settings, settingMap]);

  const lastUpdate = useMemo(() => {
    const dates = (settingsQuery.data?.settings ?? [])
      .map((setting) => setting.updated_at)
      .filter(Boolean)
      .sort();
    return dates.at(-1) ?? null;
  }, [settingsQuery.data?.settings]);

  const saveSection = async (
    key: SettingsKey,
    value: Record<string, unknown>,
    errors: ValidationErrors = {},
    dirty = true,
  ) => {
    if (!dirty) {
      toast({ title: "Không có thay đổi." });
      return;
    }

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Cài đặt chưa hợp lệ",
        description: "Vui lòng sửa các lỗi trong phần này trước khi lưu.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateSettings.mutateAsync({ key, value });
      toast({ title: "Đã lưu cài đặt." });
    } catch (error) {
      toast({
        title: "Không thể lưu cài đặt",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const payment = getPaymentValue(settingMap.get("payment_placeholder"));

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="rounded-2xl">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
        <p className="font-semibold text-destructive">Không thể tải cài đặt hệ thống.</p>
        <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(settingsQuery.error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý quy tắc vận hành toàn hệ thống. Không lưu secret hoặc khóa API trong frontend.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
          Cập nhật gần nhất: {formatDate(lastUpdate)}
        </Badge>
      </div>

      {settingsQuery.data?.warning && (
        <Alert className="rounded-2xl border-warning/30 bg-warning/5">
          <FileWarning className="h-4 w-4 text-warning" />
          <AlertDescription>
            {settingsQuery.data.warning} Nếu lưu thất bại, hãy deploy hoặc serve <code className="rounded bg-muted px-1 py-0.5">admin-settings-actions</code>.
          </AlertDescription>
        </Alert>
      )}

      <SectionCard
        title="Access & Security"
        description="Nguồn phân quyền Admin và các guardrail chống thao tác nguy hiểm."
        icon={Shield}
        onSave={() => saveSection("access_security", access, {}, accessDirty)}
        isSaving={savingKey === "access_security"}
        dirty={accessDirty}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ReadonlyField label="Admin authorization source" value="public.user_roles.role = admin" />
          <ReadonlyField label="Product role source" value="profiles.role = learner | mentor" />
          <ReadonlyField label="Current admin" value={settingsQuery.data?.admin?.email ?? "Không xác định"} />
        </div>
        <Alert className="rounded-2xl border-warning/30 bg-warning/5">
          <FileWarning className="h-4 w-4 text-warning" />
          <AlertDescription>
            Không dùng <code className="rounded bg-muted px-1 py-0.5">profiles.role</code> để phân quyền Admin. Trường đó chỉ dành cho vai trò sản phẩm learner/mentor.
          </AlertDescription>
        </Alert>
        <div className="grid gap-3 lg:grid-cols-3">
          <SettingSwitch
            label="Không thu hồi Admin cuối cùng"
            checked={access.prevent_last_admin_removal}
            onChange={(checked) => setAccess((prev) => ({ ...prev, prevent_last_admin_removal: checked }))}
          />
          <SettingSwitch
            label="Không cho Admin tự khóa mình"
            checked={access.prevent_admin_self_block}
            onChange={(checked) => setAccess((prev) => ({ ...prev, prevent_admin_self_block: checked }))}
          />
          <SettingSwitch
            label="Bắt buộc dùng admin-check"
            checked={access.require_admin_check_edge_function}
            onChange={(checked) => setAccess((prev) => ({ ...prev, require_admin_check_edge_function: checked }))}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Moderation & Reports"
        description="Quy tắc báo cáo, bằng chứng, kháng cáo và hệ thống 3 gậy."
        icon={FileWarning}
        onSave={() => saveSection("moderation_reports", moderation as unknown as Record<string, unknown>, moderationErrors, moderationDirty)}
        isSaving={savingKey === "moderation_reports"}
        dirty={moderationDirty}
        hasErrors={Object.keys(moderationErrors).length > 0}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Nội dung tối thiểu" value={moderation.report_detail_min_length} min={10} max={3000} error={moderationErrors.report_detail_min_length} onChange={(value) => setModeration((prev) => ({ ...prev, report_detail_min_length: value ?? 0 }))} suffix="ký tự" />
          <NumberField label="Nội dung tối đa" value={moderation.report_detail_max_length} min={100} max={3000} error={moderationErrors.report_detail_max_length} onChange={(value) => setModeration((prev) => ({ ...prev, report_detail_max_length: value ?? 0 }))} suffix="ký tự" />
          <NumberField label="Tiêu đề tối đa" value={moderation.report_title_max_length} min={20} max={200} error={moderationErrors.report_title_max_length} onChange={(value) => setModeration((prev) => ({ ...prev, report_title_max_length: value ?? 0 }))} suffix="ký tự" />
          <NumberField label="Lý do tối đa" value={moderation.report_reason_max_length} min={20} max={300} error={moderationErrors.report_reason_max_length} onChange={(value) => setModeration((prev) => ({ ...prev, report_reason_max_length: value ?? 0 }))} suffix="ký tự" />
          <NumberField label="Số file bằng chứng" value={moderation.evidence_max_files} min={1} max={10} error={moderationErrors.evidence_max_files} onChange={(value) => setModeration((prev) => ({ ...prev, evidence_max_files: value ?? 0 }))} suffix="file" />
          <NumberField label="Dung lượng mỗi file" value={moderation.evidence_max_file_mb} min={1} max={20} error={moderationErrors.evidence_max_file_mb} onChange={(value) => setModeration((prev) => ({ ...prev, evidence_max_file_mb: value ?? 0 }))} suffix="MB" />
          <NumberField label="Ngưỡng tự động ẩn" value={moderation.auto_hide_report_threshold} min={3} max={20} error={moderationErrors.auto_hide_report_threshold} onChange={(value) => setModeration((prev) => ({ ...prev, auto_hide_report_threshold: value ?? 0 }))} suffix="report" />
          <NumberField label="Thời hạn kháng cáo" value={moderation.appeal_window_days} min={1} max={30} error={moderationErrors.appeal_window_days} onChange={(value) => setModeration((prev) => ({ ...prev, appeal_window_days: value ?? 0 }))} suffix="ngày" />
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Gậy 1 hết hạn" value={moderation.strike_1_expire_days} min={1} max={365} error={moderationErrors.strike_1_expire_days} onChange={(value) => setModeration((prev) => ({ ...prev, strike_1_expire_days: value ?? 0 }))} suffix="ngày" />
          <NumberField label="Gậy 2 hết hạn" value={moderation.strike_2_expire_days} min={1} max={365} error={moderationErrors.strike_2_expire_days} onChange={(value) => setModeration((prev) => ({ ...prev, strike_2_expire_days: value ?? 0 }))} suffix="ngày" />
          <NumberField label="Cấm đăng sau gậy 2" value={moderation.strike_2_posting_suspension_days} min={1} max={90} error={moderationErrors.strike_2_posting_suspension_days} onChange={(value) => setModeration((prev) => ({ ...prev, strike_2_posting_suspension_days: value ?? 0 }))} suffix="ngày" />
          <SettingSwitch
            label="Gậy 3 là vĩnh viễn"
            checked={moderation.strike_3_permanent}
            onChange={(checked) => setModeration((prev) => ({ ...prev, strike_3_permanent: checked }))}
          />
        </div>
        <Alert className="rounded-2xl border-primary/20 bg-primary/5">
          <AlertDescription>
            Nhiều report chỉ kích hoạt auto-hide tạm thời. Gậy phạt chỉ được tạo sau khi Admin xác minh vi phạm.
          </AlertDescription>
        </Alert>
      </SectionCard>

      <SectionCard
        title="Mentor Verification & Trust Badges"
        description="Quy tắc xác minh mentor và hiển thị badge công khai."
        icon={BadgeCheck}
        onSave={() => saveSection("mentor_verification", verification as unknown as Record<string, unknown>, verificationErrors, verificationDirty)}
        isSaving={savingKey === "mentor_verification"}
        dirty={verificationDirty}
        hasErrors={Object.keys(verificationErrors).length > 0}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <SettingSwitch label="Cho tạo nháp trước xác minh" checked={verification.allow_mentor_create_draft_before_verified} onChange={(checked) => setVerification((prev) => ({ ...prev, allow_mentor_create_draft_before_verified: checked }))} />
          <SettingSwitch label="Cho publish trước xác minh" checked={verification.allow_mentor_publish_before_verified} onChange={(checked) => setVerification((prev) => ({ ...prev, allow_mentor_publish_before_verified: checked }))} />
          <SettingSwitch label="Cho nhận booking trước xác minh" checked={verification.allow_mentor_receive_booking_before_verified} onChange={(checked) => setVerification((prev) => ({ ...prev, allow_mentor_receive_booking_before_verified: checked }))} />
          <SettingSwitch label="Bắt buộc avatar upload" checked={verification.require_avatar_upload} onChange={(checked) => setVerification((prev) => ({ ...prev, require_avatar_upload: checked }))} />
          <SettingSwitch label="Bắt buộc ít nhất 1 bằng chứng" checked={verification.require_at_least_one_evidence} onChange={(checked) => setVerification((prev) => ({ ...prev, require_at_least_one_evidence: checked }))} />
        </div>

        <div className="rounded-2xl border p-4">
          <p className="font-medium text-foreground">Loại bằng chứng được chấp nhận</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {EVIDENCE_TYPES.map((item) => (
              <label key={item.value} className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm">
                <Checkbox
                  checked={verification.accepted_evidence_types.includes(item.value)}
                  onCheckedChange={(checked) => {
                    setVerification((prev) => ({
                      ...prev,
                      accepted_evidence_types: checked
                        ? Array.from(new Set([...prev.accepted_evidence_types, item.value]))
                        : prev.accepted_evidence_types.filter((value) => value !== item.value),
                    }));
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
          {verificationErrors.accepted_evidence_types && (
            <p className="mt-2 text-xs text-destructive">{verificationErrors.accepted_evidence_types}</p>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <SettingSwitch label="Badge VET Verified" checked={verification.show_vet_verified_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, show_vet_verified_badge: checked }))} />
          <SettingSwitch label="Badge chứng chỉ" checked={verification.show_certificate_verified_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, show_certificate_verified_badge: checked }))} />
          <SettingSwitch label="Badge portfolio" checked={verification.show_portfolio_verified_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, show_portfolio_verified_badge: checked }))} />
          <SettingSwitch label="Badge Mentor uy tín" checked={verification.show_trusted_mentor_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, show_trusted_mentor_badge: checked }))} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Gậy 1 tạm dừng trusted badge" value={verification.strike_1_suspend_trusted_badge_days} min={0} max={365} error={verificationErrors.strike_1_suspend_trusted_badge_days} onChange={(value) => setVerification((prev) => ({ ...prev, strike_1_suspend_trusted_badge_days: value ?? 0 }))} suffix="ngày" />
          <SettingSwitch label="Gậy 2 tạm dừng trusted badge" checked={verification.strike_2_suspend_trusted_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, strike_2_suspend_trusted_badge: checked }))} />
          <SettingSwitch label="Gậy 3 thu hồi trusted badge" checked={verification.strike_3_revoke_trusted_badge} onChange={(checked) => setVerification((prev) => ({ ...prev, strike_3_revoke_trusted_badge: checked }))} />
          <SettingSwitch label="Chỉ thu hồi VET Verified khi gian lận" checked={verification.revoke_vet_verified_only_for_fraud} onChange={(checked) => setVerification((prev) => ({ ...prev, revoke_vet_verified_only_for_fraud: checked }))} />
        </div>
        <Alert className="rounded-2xl border-primary/20 bg-primary/5">
          <AlertDescription>
            Đã xác minh hồ sơ và Mentor uy tín là hai trạng thái khác nhau. Report không tự động thu hồi badge; chỉ strike đã xác minh mới ảnh hưởng badge.
          </AlertDescription>
        </Alert>
      </SectionCard>

      <SectionCard
        title="Marketplace Rules"
        description="Quy tắc hiển thị khóa học công khai và cấu hình listing."
        icon={Globe2}
        onSave={() => saveSection("marketplace_rules", marketplace as unknown as Record<string, unknown>, marketplaceErrors, marketplaceDirty)}
        isSaving={savingKey === "marketplace_rules"}
        dirty={marketplaceDirty}
        hasErrors={Object.keys(marketplaceErrors).length > 0}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <SettingSwitch label="Chỉ hiện khóa đã duyệt" checked={marketplace.public_only_show_approved_courses} onChange={(checked) => setMarketplace((prev) => ({ ...prev, public_only_show_approved_courses: checked }))} />
          <SettingSwitch label="Ẩn khóa bị tạm ẩn" checked={marketplace.public_hide_hidden_courses} onChange={(checked) => setMarketplace((prev) => ({ ...prev, public_hide_hidden_courses: checked }))} />
          <SettingSwitch label="Cho phép online" checked={marketplace.allow_online_courses} onChange={(checked) => setMarketplace((prev) => ({ ...prev, allow_online_courses: checked }))} />
          <SettingSwitch label="Cho phép offline" checked={marketplace.allow_offline_courses} onChange={(checked) => setMarketplace((prev) => ({ ...prev, allow_offline_courses: checked }))} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Số ngày quảng cáo mặc định" value={marketplace.promoted_listing_default_days} min={1} max={30} error={marketplaceErrors.promoted_listing_default_days} onChange={(value) => setMarketplace((prev) => ({ ...prev, promoted_listing_default_days: value ?? 0 }))} suffix="ngày" />
          <NumberField label="Phí quảng cáo mặc định" value={marketplace.promoted_listing_default_fee} min={0} error={marketplaceErrors.promoted_listing_default_fee} onChange={(value) => setMarketplace((prev) => ({ ...prev, promoted_listing_default_fee: value ?? 0 }))} suffix="đ" />
          <NumberField label="Giá khóa học tối thiểu" value={marketplace.minimum_course_price} min={0} error={marketplaceErrors.minimum_course_price} onChange={(value) => setMarketplace((prev) => ({ ...prev, minimum_course_price: value ?? 0 }))} suffix="đ" />
          <NumberField label="Giá khóa học tối đa" value={marketplace.maximum_course_price} min={0} error={marketplaceErrors.maximum_course_price} onChange={(value) => setMarketplace((prev) => ({ ...prev, maximum_course_price: value }))} suffix="đ" />
        </div>
        <Alert className="rounded-2xl border-warning/30 bg-warning/5">
          <FileWarning className="h-4 w-4 text-warning" />
          <AlertDescription>Pending, rejected, và hidden courses không được xuất hiện ở marketplace công khai.</AlertDescription>
        </Alert>
      </SectionCard>

      <SectionCard
        title="Payment Configuration"
        description="Placeholder an toàn. Chưa triển khai thanh toán thật."
        icon={CreditCard}
        disabled
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border-0 bg-warning/10 text-warning">Đang lên kế hoạch</Badge>
          <span className="text-sm text-muted-foreground">Không nhập API token hoặc webhook secret tại frontend.</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadonlyField label="Trạng thái provider" value={payment.payment_provider_status} />
          <ReadonlyField label="Provider hiện tại" value={payment.current_provider} />
          <ReadonlyField label="Phí nền tảng" value={`${Math.round(payment.platform_fee_rate * 100)}%`} />
          <ReadonlyField label="Hold period" value={payment.hold_period} />
          <ReadonlyField label="Webhook status" value={payment.webhook_status} />
          <ReadonlyField label="Learner payment flow" value={payment.learner_payment_flow_status} />
          <ReadonlyField label="Mentor withdrawal" value={payment.mentor_withdrawal_status} />
        </div>
        <Alert className="rounded-2xl border-primary/20 bg-primary/5">
          <AlertDescription>
            Phần thanh toán đang được lên kế hoạch. Các secret sẽ được cấu hình bằng Supabase secrets khi tích hợp thật.
          </AlertDescription>
        </Alert>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            "Chọn payment provider: SePay / payOS / MoMo / VNPAY / Mock",
            "Định nghĩa payment capture flow",
            "Định nghĩa webhook verification",
            "Định nghĩa hold/release rules",
            "Định nghĩa refund/dispute rules",
            "Định nghĩa mentor withdrawal rules later",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="System Health"
        description="Trạng thái nhẹ, chỉ đọc. Không làm hỏng toàn trang nếu không xác định được."
        icon={Activity}
      >
        {healthQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["admin-check", "admin-check function"],
              ["admin-settings-actions", "admin-settings-actions"],
              ["learner-report-actions", "learner-report-actions"],
              ["learner-review-actions", "learner-review-actions"],
              ["admin-report-actions", "admin-report-actions"],
              ["payment_webhook", "Payment webhook"],
            ].map(([key, label]) => {
              const item = healthQuery.data?.health?.[key];
              const status = typeof item === "object" && item ? item.status : "unknown";
              const statusLabel = typeof item === "object" && item ? item.label : "Không xác định";
              return (
                <div key={key} className="rounded-2xl border bg-background p-4">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <Badge
                    variant="outline"
                    className={
                      status === "ok"
                        ? "mt-3 rounded-full border-success/20 bg-success/10 text-success"
                        : status === "not_configured"
                          ? "mt-3 rounded-full border-warning/20 bg-warning/10 text-warning"
                          : "mt-3 rounded-full border-muted bg-muted text-muted-foreground"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
              );
            })}
            <ReadonlyField
              label="Last payment webhook"
              value={String(healthQuery.data?.health?.last_payment_webhook_received ?? "none")}
            />
            <ReadonlyField
              label="Environment mode"
              value={String(healthQuery.data?.health?.environment_mode ?? "Không xác định")}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
