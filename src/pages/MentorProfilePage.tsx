import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { mockMentors, mockCourses, mockReviews } from "@/data/mockData";
import { Star, BadgeCheck, BookOpen, Users, Calendar, MapPin, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

export default function MentorProfilePage() {
  const { id } = useParams();
  const mentor = mockMentors.find((m) => m.id === id) || mockMentors[0];
  const mentorCourses = mockCourses.filter((c) => c.mentorName === mentor.name);

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Profile header */}
          <div className="rounded-2xl border bg-card p-6 shadow-card mb-8">
            <div className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-6">
              <img src={mentor.avatar} alt={mentor.name} className="h-24 w-24 rounded-2xl object-cover" />
              <div className="flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{mentor.name}</h1>
                  {mentor.verified && <BadgeCheck className="h-5 w-5 text-secondary" />}
                </div>
                <p className="text-muted-foreground mb-3">{mentor.specialty}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{mentor.rating} ({mentor.reviewCount} đánh giá)</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{mentor.coursesCount} khóa học</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />500+ học viên</span>
                </div>
              </div>
              {mentor.verified && (
                <Badge className="bg-success/10 text-success border-0 gap-1">
                  <Award className="h-3 w-3" />Đã xác minh
                </Badge>
              )}
            </div>

            <Separator className="my-6" />

            <div>
              <h3 className="font-semibold text-foreground mb-2">Giới thiệu</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{mentor.bio}. Với nhiều năm kinh nghiệm trong lĩnh vực, tôi cam kết mang đến phương pháp giảng dạy hiệu quả, phù hợp với từng học viên.</p>
            </div>
          </div>

          {/* Courses */}
          <h2 className="text-xl font-bold text-foreground mb-4">Khóa học của {mentor.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {(mentorCourses.length > 0 ? mentorCourses : mockCourses.slice(0, 3)).map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>

          {/* Reviews */}
          <h2 className="text-xl font-bold text-foreground mb-4">Đánh giá từ học viên</h2>
          <div className="space-y-3">
            {mockReviews.map((r) => (
              <ReviewBlock key={r.id} review={r} />
            ))}
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
