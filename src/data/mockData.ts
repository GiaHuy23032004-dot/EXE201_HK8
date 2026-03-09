import { CourseData } from "@/components/marketplace/CourseCard";
import { MentorData } from "@/components/marketplace/MentorCard";

const avatars = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
];

const courseImages = [
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1460518451285-97b6aa326961?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=400&fit=crop",
];

export const mockCourses: CourseData[] = [
  { id: "1", title: "Guitar Acoustic cho người mới bắt đầu", mentorName: "Minh Tuấn", mentorAvatar: avatars[0], price: 200000, rating: 4.9, reviewCount: 128, image: courseImages[0], category: "music", format: "offline", location: "Quận 1, TP.HCM", distance: "1.2km", promoted: true, studentsCount: 340 },
  { id: "2", title: "Tiếng Anh giao tiếp IELTS 6.5+", mentorName: "Thu Hà", mentorAvatar: avatars[1], price: 350000, rating: 4.8, reviewCount: 256, image: courseImages[1], category: "language", format: "online", studentsCount: 890 },
  { id: "3", title: "Yoga & Thiền - Cân bằng cuộc sống", mentorName: "Linh Chi", mentorAvatar: avatars[3], price: 180000, rating: 4.7, reviewCount: 89, image: courseImages[2], category: "fitness", format: "offline", location: "Quận 7, TP.HCM", distance: "3.5km", studentsCount: 210 },
  { id: "4", title: "Lập trình Web Fullstack với React", mentorName: "Đức Anh", mentorAvatar: avatars[2], price: 500000, rating: 4.9, reviewCount: 312, image: courseImages[3], category: "coding", format: "online", promoted: true, studentsCount: 1200 },
  { id: "5", title: "Nấu ăn Nhật Bản - Sushi & Ramen", mentorName: "Yuki Nguyễn", mentorAvatar: avatars[5], price: 300000, rating: 4.6, reviewCount: 67, image: courseImages[4], category: "cooking", format: "offline", location: "Quận 3, TP.HCM", distance: "2.1km", studentsCount: 150 },
  { id: "6", title: "Fitness & Gym cơ bản tại nhà", mentorName: "Hùng PT", mentorAvatar: avatars[4], price: 250000, rating: 4.8, reviewCount: 198, image: courseImages[5], category: "fitness", format: "online", studentsCount: 560 },
  { id: "7", title: "Vẽ tranh sơn dầu nghệ thuật", mentorName: "Mai Anh", mentorAvatar: avatars[3], price: 280000, rating: 4.5, reviewCount: 45, image: courseImages[7], category: "art", format: "offline", location: "Quận Bình Thạnh", distance: "4.0km", studentsCount: 90 },
  { id: "8", title: "Piano cổ điển từ cơ bản đến nâng cao", mentorName: "Hoàng Long", mentorAvatar: avatars[0], price: 400000, rating: 4.9, reviewCount: 175, image: courseImages[6], category: "music", format: "offline", location: "Quận 2, TP.HCM", distance: "5.2km", promoted: true, studentsCount: 430 },
];

export const mockMentors: MentorData[] = [
  { id: "1", name: "Minh Tuấn", avatar: avatars[0], specialty: "Guitar & Âm nhạc", rating: 4.9, reviewCount: 128, coursesCount: 5, verified: true, bio: "10 năm kinh nghiệm giảng dạy guitar" },
  { id: "2", name: "Thu Hà", avatar: avatars[1], specialty: "IELTS & Tiếng Anh", rating: 4.8, reviewCount: 256, coursesCount: 8, verified: true, bio: "IELTS 8.5, giảng viên đại học" },
  { id: "3", name: "Đức Anh", avatar: avatars[2], specialty: "Lập trình & Công nghệ", rating: 4.9, reviewCount: 312, coursesCount: 12, verified: true, bio: "Senior Developer tại công ty công nghệ lớn" },
  { id: "4", name: "Linh Chi", avatar: avatars[3], specialty: "Yoga & Thiền", rating: 4.7, reviewCount: 89, coursesCount: 3, verified: false, bio: "Chứng chỉ RYT-500" },
  { id: "5", name: "Hùng PT", avatar: avatars[4], specialty: "Fitness & Gym", rating: 4.8, reviewCount: 198, coursesCount: 6, verified: true, bio: "HLV cá nhân chuyên nghiệp" },
  { id: "6", name: "Yuki Nguyễn", avatar: avatars[5], specialty: "Ẩm thực Nhật Bản", rating: 4.6, reviewCount: 67, coursesCount: 4, verified: true, bio: "Đầu bếp từng tu nghiệp tại Tokyo" },
];

export const mockReviews = [
  { id: "1", userName: "Ngọc Trâm", userAvatar: avatars[3], rating: 5, comment: "Thầy dạy rất tận tâm, mình đã biết chơi guitar cơ bản sau 2 tháng!", date: "2 ngày trước" },
  { id: "2", userName: "Văn Hải", userAvatar: avatars[4], rating: 4, comment: "Lớp học rất vui, mentor nhiệt tình. Chỉ hơi xa nhà thôi.", date: "1 tuần trước" },
  { id: "3", userName: "Thanh Nga", userAvatar: avatars[1], rating: 5, comment: "Tuyệt vời! Đã đặt thêm 10 buổi nữa. Highly recommend!", date: "3 ngày trước" },
  { id: "4", userName: "Quốc Bảo", userAvatar: avatars[2], rating: 5, comment: "Khóa lập trình React rất chất lượng, kiến thức thực tế.", date: "5 ngày trước" },
];

export const categories = [
  { slug: "music", label: "Âm nhạc" },
  { slug: "language", label: "Ngoại ngữ" },
  { slug: "coding", label: "Lập trình" },
  { slug: "art", label: "Nghệ thuật" },
  { slug: "fitness", label: "Thể dục" },
  { slug: "cooking", label: "Nấu ăn" },
  { slug: "business", label: "Kinh doanh" },
  { slug: "design", label: "Thiết kế" },
];
