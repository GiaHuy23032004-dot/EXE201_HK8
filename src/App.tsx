import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AiChatAssistant } from "@/components/AiChatAssistant";
import { AdminGuard } from "@/components/AdminGuard";
import { MentorGuard } from "@/components/MentorGuard";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import SearchPage from "./pages/SearchPage";
import MapPage from "./pages/MapPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import BookingPage from "./pages/BookingPage";
import LearnerDashboard from "./pages/LearnerDashboard";
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
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/course/:id" element={<CourseDetailPage />} />
            <Route path="/booking/:id" element={<BookingPage />} />
            <Route path="/learner/dashboard" element={<LearnerDashboard />} />
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
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AiChatAssistant />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
