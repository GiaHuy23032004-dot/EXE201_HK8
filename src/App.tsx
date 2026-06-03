import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { AiChatAssistant } from "@/components/AiChatAssistant";
import { AdminGuard } from "@/components/AdminGuard";
import { MentorGuard } from "@/components/MentorGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import SearchPage from "./pages/SearchPage";
import MapPage from "./pages/MapPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import BookingPage from "./pages/BookingPage";
import LearnerDashboard from "./pages/LearnerDashboard";
import LearnerReports from "./pages/LearnerReports";
import MentorDashboard from "./pages/MentorDashboard";
import MentorCourses from "./pages/MentorCourses";
import MentorSchedule from "./pages/mentor/MentorSchedule";
import MentorStudents from "./pages/mentor/MentorStudents";
import MentorProfile from "./pages/mentor/MentorProfile";
import MentorSettings from "./pages/mentor/MentorSettings";
import MentorVerification from "./pages/mentor/MentorVerification";
import MentorProfilePage from "./pages/MentorProfilePage";
import CreateCoursePage from "./pages/CreateCoursePage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMentorVerifications from "./pages/admin/AdminMentorVerifications";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminReports from "./pages/admin/AdminReports";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminLedger from "./pages/admin/AdminLedger";
import AdminSettings from "./pages/admin/AdminSettings";
import MapConfigPage from "./pages/dev/MapConfigPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ReceiptPage from "./pages/ReceiptPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  );
}

function AppExtras() {
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return <AiChatAssistant />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dev/map-config" element={<MapConfigPage />} />
            <Route path="/course/:id" element={<CourseDetailPage />} />
            <Route path="/booking/:id" element={<BookingPage />} />
            <Route path="/learner/dashboard" element={<LearnerDashboard />} />
            <Route path="/learner/reports" element={<LearnerReports />} />
            <Route path="/mentor/dashboard" element={<MentorGuard><MentorDashboard /></MentorGuard>} />
            <Route path="/mentor/courses"   element={<MentorGuard><MentorCourses /></MentorGuard>} />
            <Route path="/mentor/schedule"  element={<MentorGuard><MentorSchedule /></MentorGuard>} />
            <Route path="/mentor/wallet"    element={<MentorGuard><MentorDashboard /></MentorGuard>} />
            <Route path="/mentor/students"  element={<MentorGuard><MentorStudents /></MentorGuard>} />
            <Route path="/mentor/profile"   element={<MentorGuard><MentorProfile /></MentorGuard>} />
            <Route path="/mentor/settings"  element={<MentorGuard><MentorSettings /></MentorGuard>} />
            <Route path="/mentor/verification" element={<MentorGuard><MentorVerification /></MentorGuard>} />
            <Route path="/mentor/create-course" element={<CreateCoursePage />} />
            <Route path="/mentor/:id" element={<MentorProfilePage />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/mentors" element={<AdminRoute><AdminMentorVerifications /></AdminRoute>} />
            <Route path="/admin/mentor-verifications" element={<AdminRoute><AdminMentorVerifications /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
            <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
            <Route path="/admin/withdrawals" element={<AdminRoute><AdminWithdrawals /></AdminRoute>} />
            <Route path="/admin/ledger" element={<AdminRoute><AdminLedger /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/receipt/:bookingId" element={<ReceiptPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AppExtras />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
