import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Language = "vi" | "en";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

// ── Translations ──────────────────────────────────────────────────────────────

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Navbar
    "nav.home": "Trang chủ",
    "nav.search": "Tìm kiếm",
    "nav.map": "Bản đồ",
    "nav.pricing": "VET Plus",
    "nav.login": "Đăng nhập",
    "nav.logout": "Đăng xuất",
    "nav.profile": "Hồ sơ cá nhân",
    "nav.settings": "Cài đặt",
    "nav.myplan": "Gói của tôi",
    "nav.notifications": "Thông báo",
    "nav.markread": "Đánh dấu đã đọc",
    "nav.viewall": "Xem tất cả",
    "nav.learner_dashboard": "Trang học viên",
    "nav.mentor_dashboard": "Quản lý dạy học",

    // Mentor sidebar
    "mentor.overview": "Tổng quan",
    "mentor.courses": "Khóa học của tôi",
    "mentor.schedule": "Lịch dạy",
    "mentor.wallet": "Doanh thu & Ví",
    "mentor.promotions": "Quảng cáo",
    "mentor.students": "Quản lý học viên",
    "mentor.profile": "Hồ sơ & xác minh",
    "mentor.settings": "Cài đặt",
    "mentor.create_course": "Tạo khóa học mới",
    "mentor.home": "Về trang chủ",

    // Admin sidebar
    "admin.dashboard": "Dashboard",
    "admin.users": "Users",
    "admin.mentor_verification": "Mentor Verification",
    "admin.courses": "Courses",
    "admin.reports": "Reports",
    "admin.promotions": "Promotions",
    "admin.withdrawals": "Withdrawals",
    "admin.ledger": "Ledger",
    "admin.subscriptions": "Gói VET Plus",
    "admin.settings": "Settings",
    "admin.panel": "Admin Panel",
    "admin.view_marketplace": "Xem Marketplace",
    "admin.logout": "Logout",

    // Common actions
    "action.save": "Lưu",
    "action.cancel": "Hủy",
    "action.confirm": "Xác nhận",
    "action.delete": "Xóa",
    "action.edit": "Chỉnh sửa",
    "action.close": "Đóng",
    "action.search": "Tìm kiếm",
    "action.filter": "Lọc",
    "action.loading": "Đang tải...",
    "action.submit": "Gửi",
    "action.back": "Quay lại",
    "action.next": "Tiếp theo",
    "action.approve": "Duyệt",
    "action.reject": "Từ chối",
    "action.view": "Xem",
    "action.download": "Tải xuống",
    "action.copy": "Sao chép",
    "action.copied": "Đã sao chép",

    // Common status
    "status.pending": "Chờ duyệt",
    "status.active": "Đang hoạt động",
    "status.inactive": "Không hoạt động",
    "status.approved": "Đã duyệt",
    "status.rejected": "Bị từ chối",
    "status.completed": "Hoàn thành",
    "status.cancelled": "Đã hủy",
    "status.expired": "Hết hạn",
    "status.success": "Thành công",
    "status.failed": "Thất bại",

    // Language switcher
    "lang.vi": "Tiếng Việt",
    "lang.en": "English",
    "lang.switch": "Đổi ngôn ngữ",
  },

  en: {
    // Navbar
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.map": "Map",
    "nav.pricing": "VET Plus",
    "nav.login": "Login",
    "nav.logout": "Logout",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.myplan": "My Plan",
    "nav.notifications": "Notifications",
    "nav.markread": "Mark all read",
    "nav.viewall": "View all",
    "nav.learner_dashboard": "Learner Dashboard",
    "nav.mentor_dashboard": "Teaching Dashboard",

    // Mentor sidebar
    "mentor.overview": "Overview",
    "mentor.courses": "My Courses",
    "mentor.schedule": "Schedule",
    "mentor.wallet": "Revenue & Wallet",
    "mentor.promotions": "Promotions",
    "mentor.students": "Students",
    "mentor.profile": "Profile & Verification",
    "mentor.settings": "Settings",
    "mentor.create_course": "Create New Course",
    "mentor.home": "Back to Home",

    // Admin sidebar
    "admin.dashboard": "Dashboard",
    "admin.users": "Users",
    "admin.mentor_verification": "Mentor Verification",
    "admin.courses": "Courses",
    "admin.reports": "Reports",
    "admin.promotions": "Promotions",
    "admin.withdrawals": "Withdrawals",
    "admin.ledger": "Ledger",
    "admin.subscriptions": "VET Plus Plans",
    "admin.settings": "Settings",
    "admin.panel": "Admin Panel",
    "admin.view_marketplace": "View Marketplace",
    "admin.logout": "Logout",

    // Common actions
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.confirm": "Confirm",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.close": "Close",
    "action.search": "Search",
    "action.filter": "Filter",
    "action.loading": "Loading...",
    "action.submit": "Submit",
    "action.back": "Back",
    "action.next": "Next",
    "action.approve": "Approve",
    "action.reject": "Reject",
    "action.view": "View",
    "action.download": "Download",
    "action.copy": "Copy",
    "action.copied": "Copied",

    // Common status
    "status.pending": "Pending",
    "status.active": "Active",
    "status.inactive": "Inactive",
    "status.approved": "Approved",
    "status.rejected": "Rejected",
    "status.completed": "Completed",
    "status.cancelled": "Cancelled",
    "status.expired": "Expired",
    "status.success": "Success",
    "status.failed": "Failed",

    // Language switcher
    "lang.vi": "Tiếng Việt",
    "lang.en": "English",
    "lang.switch": "Switch language",
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  lang: "vi",
  setLang: () => {},
  t: (key) => key,
});

const STORAGE_KEY = "vet_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" ? "en" : "vi";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  };

  const t = (key: string): string => {
    return translations[lang][key] ?? translations["vi"][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
