import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROADMAP_CREDIT_COST = 3;
const VALID_CATEGORIES = [
  "mind-sports",
  "career-english",
  "modern-sports",
  "barista-beverage",
  "content-speaking",
  "ai-productivity",
] as const;

type CourseCategory = (typeof VALID_CATEGORIES)[number];
type Level = "beginner" | "intermediate" | "advanced" | "unknown";
type PreferredFormat = "online" | "offline" | "any";

type ReserveResult = {
  ok?: boolean;
  success?: boolean;
  usage_log_id?: string | null;
  usageLogId?: string | null;
  id?: string | null;
  reason?: string | null;
  error?: string | null;
  credits_remaining?: number | null;
  creditsRemaining?: number | null;
  ai_credits_remaining?: number | null;
};

type RoadmapCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  rating: number | null;
  review_count: number | null;
  mentor?: { name?: string | null } | null;
};

type LearningProfile = {
  primary_goal?: string | null;
  current_level?: string | null;
  preferred_categories?: string[] | null;
  preferred_format?: PreferredFormat | null;
  budget_min?: number | null;
  budget_max?: number | null;
  location_preference?: string | null;
  schedule_preference?: string | null;
  learning_style?: string | null;
  notes?: string | null;
};

type RoadmapResult = {
  roadmap_title: string;
  goal_summary: string;
  estimated_duration_weeks: number;
  weekly_plan: Array<{
    week: number;
    focus: string;
    tasks: string[];
    practice_assignment?: string;
    milestone?: string;
    suggested_course_ids: string[];
  }>;
  recommended_courses: Array<{
    course_id: string;
    reason: string;
  }>;
  study_tips: string[];
  next_step: string;
};

type WeekTemplate = {
  focus: string;
  tasks: string[];
  practice_assignment: string;
  milestone: string;
};

const NO_COURSE_MESSAGE =
  "Chưa có khóa phù hợp với ngân sách/bộ lọc hiện tại. Bạn có thể điều chỉnh ngân sách hoặc hình thức học để nhận gợi ý khóa học.";

const CATEGORY_ROADMAPS: Record<CourseCategory, {
  label: string;
  title: string;
  modules: string[];
  weeks: WeekTemplate[];
  studyTips: string[];
  nextStep: string;
  courseReason: string;
}> = {
  "career-english": {
    label: "Tiếng Anh công việc & học tập",
    title: "Lộ trình tiếng Anh công việc & học tập",
    modules: [
      "phát âm nền tảng",
      "từ vựng học tập/công việc",
      "phản xạ speaking",
      "hội thoại tình huống",
      "email hoặc phỏng vấn nếu phù hợp",
      "milestone theo tuần",
    ],
    weeks: [
      {
        focus: "Kiểm tra trình độ và chỉnh phát âm nền tảng",
        tasks: [
          "Ghi âm 1 đoạn giới thiệu bản thân 60 giây để xác định lỗi phát âm.",
          "Luyện 10 âm/cụm âm thường gây khó và 30 câu giao tiếp cá nhân.",
          "Tạo sổ từ vựng gồm mục tiêu học tập, công việc, lịch học và sở thích.",
        ],
        practice_assignment: "Gửi mentor bản ghi âm giới thiệu bản thân và danh sách 10 lỗi phát âm muốn sửa.",
        milestone: "Nói được phần giới thiệu bản thân 60 giây rõ ý và ít ngập ngừng hơn.",
      },
      {
        focus: "Từ vựng công việc/học tập và phản xạ câu ngắn",
        tasks: [
          "Học 40 cụm từ theo chủ đề công việc/học tập liên quan đến mục tiêu.",
          "Luyện hỏi đáp nhanh bằng mẫu câu I need, I can, I have, I want to.",
          "Role-play tình huống giới thiệu bản thân, mô tả lịch học hoặc công việc.",
        ],
        practice_assignment: "Thực hiện 2 đoạn role-play 3 phút: giới thiệu bản thân và hỏi thông tin khóa học.",
        milestone: "Phản hồi được các câu hỏi cơ bản trong 3 giây với câu đủ ý.",
      },
      {
        focus: "Hội thoại tình huống và sửa lỗi diễn đạt",
        tasks: [
          "Luyện 3 tình huống: đặt lịch, hỏi giá, trình bày khó khăn khi học.",
          "Ghi lại lỗi ngữ pháp lặp lại và viết lại câu đúng.",
          "Tập shadowing 10 phút/ngày với đoạn hội thoại ngắn.",
        ],
        practice_assignment: "Nộp transcript 1 đoạn hội thoại 2 người và tự đánh dấu câu cần sửa.",
        milestone: "Duy trì được hội thoại 5 phút về mục tiêu học tập/công việc.",
      },
      {
        focus: "Ứng dụng: email, phỏng vấn hoặc thuyết trình ngắn",
        tasks: [
          "Viết 1 email ngắn hoặc câu trả lời phỏng vấn phù hợp với mục tiêu.",
          "Luyện trình bày 2 phút về một chủ đề quen thuộc.",
          "Nhận feedback từ mentor và sửa phiên bản cuối.",
        ],
        practice_assignment: "Hoàn thiện 1 sản phẩm cuối: email, intro phỏng vấn hoặc mini presentation.",
        milestone: "Có sản phẩm tiếng Anh thực tế để dùng trong học tập/công việc.",
      },
    ],
    studyTips: [
      "Ghi âm hằng tuần để thấy tiến bộ phát âm và phản xạ.",
      "Ưu tiên cụm từ dùng được ngay thay vì học từ rời rạc.",
      "Mỗi buổi nên có ít nhất một phần role-play với mentor.",
    ],
    nextStep: "Chọn khóa có mentor hỗ trợ speaking/feedback cá nhân và gửi trước mục tiêu cụ thể của bạn.",
    courseReason: "Khóa này phù hợp để luyện speaking, phản xạ và feedback theo mục tiêu tiếng Anh của bạn.",
  },
  "modern-sports": {
    label: "Thể thao hiện đại",
    title: "Lộ trình thể thao hiện đại",
    modules: [
      "an toàn khi tập",
      "luật chơi",
      "kỹ thuật cơ bản",
      "drill từng buổi",
      "thể lực nhẹ",
      "thực hành với partner/coach",
    ],
    weeks: [
      {
        focus: "An toàn, luật chơi và động tác nền tảng",
        tasks: [
          "Tìm hiểu luật cơ bản, khu vực sân/bài tập và lỗi thường gặp.",
          "Khởi động 10 phút với bài linh hoạt cổ chân, gối, vai và hông.",
          "Luyện tư thế chuẩn bị, di chuyển cơ bản và cách cầm/dùng dụng cụ nếu có.",
        ],
        practice_assignment: "Quay 3 clip ngắn tư thế chuẩn bị, di chuyển và động tác cơ bản để mentor sửa.",
        milestone: "Nắm luật an toàn và thực hiện được động tác nền tảng không đau/không sai tư thế lớn.",
      },
      {
        focus: "Kỹ thuật cơ bản và drill kiểm soát",
        tasks: [
          "Luyện 2-3 kỹ thuật chính theo môn: giao bóng/đỡ bóng/đổi hướng hoặc bài tương đương.",
          "Thực hiện drill lặp lại 5 hiệp, mỗi hiệp 2-3 phút, nghỉ ngắn.",
          "Ghi lại lỗi kỹ thuật xuất hiện nhiều nhất sau mỗi buổi.",
        ],
        practice_assignment: "Hoàn thành checklist drill 3 buổi và ghi điểm tự đánh giá độ ổn định.",
        milestone: "Thực hiện được kỹ thuật cơ bản với độ ổn định khoảng 60-70%.",
      },
      {
        focus: "Phối hợp, thể lực nhẹ và thực hành với partner",
        tasks: [
          "Thêm bài footwork/phản xạ nhẹ 10-15 phút mỗi buổi.",
          "Tập phối hợp với partner hoặc coach qua tình huống thực tế.",
          "Chơi/tập set ngắn để áp dụng luật và kỹ thuật đã học.",
        ],
        practice_assignment: "Tham gia 1 buổi thực hành có partner và ghi lại 3 điểm cần sửa.",
        milestone: "Áp dụng được kỹ thuật vào tình huống thực tế thay vì chỉ drill riêng lẻ.",
      },
      {
        focus: "Chiến thuật cơ bản và đánh giá tiến bộ",
        tasks: [
          "Học 2 nguyên tắc chiến thuật đơn giản: chọn vị trí và ra quyết định.",
          "Tập một bài mô phỏng trận/hiệp ngắn với mục tiêu cụ thể.",
          "So sánh video tuần đầu và tuần hiện tại để nhận diện tiến bộ.",
        ],
        practice_assignment: "Hoàn thành 1 buổi kiểm tra nhỏ với mentor/coach và nhận feedback cuối.",
        milestone: "Có kế hoạch luyện tiếp theo dựa trên lỗi kỹ thuật và mục tiêu thể lực.",
      },
    ],
    studyTips: [
      "Luôn ưu tiên khởi động, cooldown và kỹ thuật đúng hơn tốc độ.",
      "Dùng video ngắn để mentor sửa tư thế chính xác hơn.",
      "Không tăng cường độ quá nhanh nếu còn đau hoặc sai động tác.",
    ],
    nextStep: "Chọn mentor/coach có thể sửa kỹ thuật trực tiếp và hỏi trước về yêu cầu dụng cụ, sân tập, mức độ an toàn.",
    courseReason: "Khóa này phù hợp để học kỹ thuật nền tảng, drill và feedback an toàn theo môn thể thao bạn chọn.",
  },
  "mind-sports": {
    label: "Cờ & Tư duy chiến thuật",
    title: "Lộ trình cờ & tư duy chiến thuật",
    modules: [
      "luật chơi",
      "ký hiệu",
      "tư duy chiến thuật",
      "khai cuộc/cơ bản",
      "bài tập thế cờ",
      "phân tích ván và luyện đấu",
    ],
    weeks: [
      {
        focus: "Luật, ký hiệu và nhận diện thế cơ bản",
        tasks: [
          "Ôn luật, cách ghi nước đi/ký hiệu và mục tiêu thắng/thua/hòa.",
          "Làm 20 bài nhận diện thế cơ bản: chiếu, bắt quân, phòng thủ, đổi quân.",
          "Chơi 2 ván chậm, ghi lại 3 thời điểm ra quyết định khó.",
        ],
        practice_assignment: "Nộp 1 ván đã ghi nước đi và tự chú thích 3 nước bạn chưa chắc.",
        milestone: "Hiểu luật, đọc được ký hiệu cơ bản và giải được thế đơn giản.",
      },
      {
        focus: "Khai cuộc nền tảng và nguyên tắc phát triển",
        tasks: [
          "Học 3 nguyên tắc khai cuộc: phát triển quân, kiểm soát trung tâm, an toàn vua/tướng.",
          "Phân tích 5 khai cuộc mẫu phù hợp trình độ.",
          "Chơi 3 ván chỉ tập trung không mắc lỗi khai cuộc lặp lại.",
        ],
        practice_assignment: "Lập checklist khai cuộc cá nhân và đánh dấu sau mỗi ván.",
        milestone: "Vào trung cuộc với thế ổn định hơn và ít mất quân sớm.",
      },
      {
        focus: "Chiến thuật: ghim, xiên, bẫy và phối hợp quân",
        tasks: [
          "Giải 30 bài chiến thuật theo chủ đề.",
          "Sau mỗi bài, viết 1 câu giải thích ý tưởng chính.",
          "Tập nhìn trước 2-3 nước trước khi ra quyết định.",
        ],
        practice_assignment: "Chọn 5 bài sai nhiều nhất và nhờ mentor giải thích lại.",
        milestone: "Nhận diện được mẫu chiến thuật thường gặp trong ván thật.",
      },
      {
        focus: "Phân tích ván và luyện đấu có mục tiêu",
        tasks: [
          "Chơi 3-5 ván luyện đấu có kiểm soát thời gian.",
          "Phân tích lại ván: khai cuộc, bước ngoặt, lỗi chiến thuật, tàn cuộc.",
          "Tạo danh sách 3 lỗi cần sửa trong chu kỳ tiếp theo.",
        ],
        practice_assignment: "Gửi 1 ván thua để mentor phân tích và đề xuất bài tập bù.",
        milestone: "Biết tự review ván và chuyển lỗi thành bài tập luyện cụ thể.",
      },
    ],
    studyTips: [
      "Không chỉ chơi nhiều; hãy phân tích ván thua để thấy lỗi tư duy.",
      "Giải bài chiến thuật ngắn mỗi ngày tốt hơn học lý thuyết dài nhưng ít dùng.",
      "Ghi lại mẫu lỗi lặp lại sau mỗi tuần.",
    ],
    nextStep: "Chọn khóa có mentor phân tích ván và giao bài tập thế cờ theo trình độ hiện tại.",
    courseReason: "Khóa này phù hợp để luyện luật, chiến thuật, bài tập thế cờ và phân tích ván có mentor.",
  },
  "barista-beverage": {
    label: "Barista & Đồ uống",
    title: "Lộ trình Barista & Đồ uống",
    modules: [
      "dụng cụ",
      "nguyên liệu",
      "quy trình pha chế",
      "espresso/latte art nếu phù hợp",
      "menu/costing",
      "thực hành theo buổi",
    ],
    weeks: [
      {
        focus: "Dụng cụ, nguyên liệu và quy trình vệ sinh",
        tasks: [
          "Nhận diện dụng cụ chính: máy pha, grinder, ca đánh sữa, cân, tamper hoặc bộ dụng cụ tương ứng.",
          "Tìm hiểu nguyên liệu nền: cà phê/trà/sữa/syrup và cách bảo quản.",
          "Thực hành quy trình vệ sinh, chuẩn bị quầy và đo định lượng cơ bản.",
        ],
        practice_assignment: "Lập checklist setup quầy và quay 1 quy trình chuẩn bị trước khi pha.",
        milestone: "Chuẩn bị được dụng cụ/nguyên liệu đúng quy trình và an toàn vệ sinh.",
      },
      {
        focus: "Công thức nền và kiểm soát định lượng",
        tasks: [
          "Thực hành 2-3 công thức nền theo mục tiêu: espresso, latte, cold brew, trà sữa hoặc mocktail.",
          "Dùng cân/thìa đo để ghi định lượng và thời gian pha.",
          "So sánh hương vị khi thay đổi một biến số nhỏ.",
        ],
        practice_assignment: "Nộp bảng recipe log gồm định lượng, thời gian, nhận xét vị cho 3 lần thử.",
        milestone: "Pha được đồ uống nền ổn định với công thức có thể lặp lại.",
      },
      {
        focus: "Kỹ thuật nâng cao: espresso/latte art hoặc phối vị",
        tasks: [
          "Nếu học cà phê: luyện chiết xuất espresso, đánh sữa và pouring cơ bản.",
          "Nếu học đồ uống khác: luyện cân bằng vị ngọt, chua, béo, đắng.",
          "Nhận feedback từ mentor qua hương vị, texture và trình bày.",
        ],
        practice_assignment: "Tạo 1 phiên bản đồ uống cải tiến và giải thích lý do chỉnh công thức.",
        milestone: "Biết điều chỉnh công thức dựa trên lỗi hương vị hoặc texture.",
      },
      {
        focus: "Menu nhỏ, costing và sản phẩm cuối",
        tasks: [
          "Tính giá vốn cơ bản cho 2-3 món.",
          "Thiết kế menu mini phù hợp mục tiêu cá nhân/công việc.",
          "Thực hiện buổi demo pha chế hoàn chỉnh có quy trình và trình bày.",
        ],
        practice_assignment: "Hoàn thiện 1 menu mini 3 món kèm recipe và costing cơ bản.",
        milestone: "Có sản phẩm thực hành cuối kỳ có thể đưa vào portfolio cá nhân.",
      },
    ],
    studyTips: [
      "Ghi recipe log sau mỗi lần pha để kiểm soát chất lượng.",
      "Chỉ thay đổi một biến số mỗi lần để hiểu nguyên nhân vị thay đổi.",
      "Luôn giữ checklist vệ sinh và an toàn nguyên liệu.",
    ],
    nextStep: "Chọn khóa có nhiều buổi thực hành và hỏi mentor về dụng cụ/nguyên liệu cần chuẩn bị trước.",
    courseReason: "Khóa này phù hợp để luyện quy trình pha chế, kiểm soát công thức và thực hành sản phẩm đồ uống.",
  },
  "content-speaking": {
    label: "Nội dung, MC & Thuyết trình",
    title: "Lộ trình Nội dung, MC & Thuyết trình",
    modules: [
      "giọng nói",
      "cấu trúc bài nói/kịch bản",
      "luyện camera/sân khấu",
      "MC/thuyết trình",
      "feedback",
      "sản phẩm cuối kỳ",
    ],
    weeks: [
      {
        focus: "Chủ đề, giọng nói và cấu trúc mở-thân-kết",
        tasks: [
          "Chọn 1 chủ đề cá nhân hoặc nghề nghiệp để luyện xuyên suốt.",
          "Luyện hơi thở, tốc độ nói, nhấn nhá và phát âm rõ.",
          "Viết outline mở-thân-kết cho bài nói 2 phút.",
        ],
        practice_assignment: "Quay video 2 phút theo outline và tự đánh dấu đoạn nói chưa rõ.",
        milestone: "Có bài nói ngắn có cấu trúc và giọng ổn định hơn.",
      },
      {
        focus: "Kịch bản, storytelling và giữ chú ý người nghe",
        tasks: [
          "Viết kịch bản ngắn có hook, ví dụ, thông điệp chính.",
          "Luyện chuyển đoạn và xử lý khi quên ý.",
          "Nhận feedback về câu chữ, nhịp nói và mức độ thuyết phục.",
        ],
        practice_assignment: "Nộp script 400-600 chữ và video đọc thử phiên bản 1.",
        milestone: "Biết biến ý tưởng thành script có mạch và dễ theo dõi.",
      },
      {
        focus: "Luyện camera/sân khấu và tương tác",
        tasks: [
          "Tập ánh mắt, biểu cảm, tay và vị trí đứng/ngồi.",
          "Luyện 2 tình huống: MC giới thiệu chương trình hoặc thuyết trình đề xuất.",
          "Chỉnh ngôn ngữ cơ thể dựa trên video feedback.",
        ],
        practice_assignment: "Quay 1 video có tương tác giả lập với khán giả hoặc camera.",
        milestone: "Tự tin hơn khi nói trước camera/sân khấu và giảm động tác thừa.",
      },
      {
        focus: "Sản phẩm cuối kỳ và vòng feedback",
        tasks: [
          "Hoàn thiện script cuối cùng.",
          "Quay hoặc trình bày bản final 3-5 phút.",
          "Nhận feedback và lập checklist cải thiện cho lần tiếp theo.",
        ],
        practice_assignment: "Hoàn thiện video/bài thuyết trình cuối kỳ có thể dùng làm portfolio.",
        milestone: "Có sản phẩm cuối kỳ thể hiện rõ giọng nói, cấu trúc và phong thái.",
      },
    ],
    studyTips: [
      "Luôn quay lại bài nói; cảm giác khi nói thường khác với dữ liệu video.",
      "Script tốt cần hook rõ, ví dụ cụ thể và một thông điệp chính.",
      "Feedback nên tách thành giọng nói, nội dung và phong thái để dễ sửa.",
    ],
    nextStep: "Chọn mentor có thể feedback video/bài nói và gửi trước chủ đề bạn muốn luyện.",
    courseReason: "Khóa này phù hợp để luyện giọng, script, camera/sân khấu và nhận feedback cụ thể.",
  },
  "ai-productivity": {
    label: "AI & Công cụ làm việc",
    title: "Lộ trình AI & Công cụ làm việc",
    modules: [
      "prompt cơ bản",
      "AI cho học tập/công việc",
      "workflow",
      "automation nhẹ",
      "project thực hành",
      "checklist ứng dụng thực tế",
    ],
    weeks: [
      {
        focus: "Prompt cơ bản và quản lý ghi chú",
        tasks: [
          "Học cấu trúc prompt: vai trò, bối cảnh, yêu cầu, định dạng đầu ra.",
          "Tạo bộ prompt cá nhân cho ghi chú, tóm tắt và lập kế hoạch.",
          "Thiết lập workflow lưu trữ kết quả AI để tái sử dụng.",
        ],
        practice_assignment: "Tạo 5 prompt dùng cho công việc/học tập thật và lưu thành template.",
        milestone: "Viết được prompt rõ yêu cầu và nhận output có thể dùng lại.",
      },
      {
        focus: "Ứng dụng AI vào workflow học tập/công việc",
        tasks: [
          "Chọn 1 quy trình đang mất thời gian: email, báo cáo, research, kế hoạch.",
          "Thiết kế workflow gồm input, bước AI hỗ trợ, kiểm tra chất lượng, output.",
          "Thực hành 2 lần với dữ liệu thật nhưng không đưa thông tin nhạy cảm.",
        ],
        practice_assignment: "Nộp workflow một trang mô tả trước/sau khi dùng AI.",
        milestone: "Rút ngắn được một tác vụ cụ thể bằng workflow có kiểm soát.",
      },
      {
        focus: "Automation nhẹ và kiểm tra chất lượng",
        tasks: [
          "Tìm công cụ phù hợp: bảng tính, form, note app, automation no-code nếu cần.",
          "Tạo checklist kiểm tra hallucination, nguồn dữ liệu và tính riêng tư.",
          "Kết nối 2-3 bước bán tự động cho một tác vụ lặp lại.",
        ],
        practice_assignment: "Demo một automation nhỏ hoặc checklist vận hành cho tác vụ lặp lại.",
        milestone: "Có quy trình AI an toàn, kiểm tra được và không phụ thuộc mù quáng vào output.",
      },
      {
        focus: "Project ứng dụng thực tế",
        tasks: [
          "Chọn project mini: bộ prompt, dashboard nội dung, kế hoạch học, workflow báo cáo.",
          "Hoàn thiện bản demo có input-output rõ ràng.",
          "Nhận feedback từ mentor và viết hướng dẫn dùng lại.",
        ],
        practice_assignment: "Hoàn thành 1 project mini áp dụng AI vào mục tiêu thực tế của bạn.",
        milestone: "Có sản phẩm ứng dụng AI cụ thể để dùng trong học tập/công việc.",
      },
    ],
    studyTips: [
      "Không đưa dữ liệu nhạy cảm vào AI nếu chưa có chính sách bảo mật rõ ràng.",
      "Luôn kiểm tra lại output bằng nguồn đáng tin cậy hoặc tiêu chí tự đặt.",
      "Lưu prompt tốt thành template để giảm thời gian lặp lại.",
    ],
    nextStep: "Chọn khóa có project thực hành và hỏi mentor về công cụ sẽ dùng trong buổi học.",
    courseReason: "Khóa này phù hợp để học prompt, workflow, automation nhẹ và project AI ứng dụng thực tế.",
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReserveResult(value: unknown) {
  const row = firstRow(value as ReserveResult | ReserveResult[]) ?? {};
  const creditsRemaining = Number(row.credits_remaining ?? row.creditsRemaining ?? row.ai_credits_remaining ?? 0);
  return {
    ok: row.ok === true || row.success === true,
    usageLogId: row.usage_log_id ?? row.usageLogId ?? row.id ?? null,
    reason: row.reason ?? row.error ?? "insufficient_credits",
    creditsRemaining: Number.isFinite(creditsRemaining) ? creditsRemaining : 0,
  };
}

function getServiceSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getAuthedSupabase(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để tạo lộ trình AI." }, 401),
      supabase: null,
      userId: null,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonResponse({ error: true, message: "Supabase environment is not configured." }, 500), supabase: null, userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Phiên đăng nhập không hợp lệ." }, 401),
      supabase: null,
      userId: null,
    };
  }
  return { error: null, supabase, userId: data.user.id };
}

function learningProfileContext(profile: LearningProfile | null) {
  if (!profile) return null;
  return {
    goal: profile.primary_goal?.slice(0, 220) ?? null,
    level: profile.current_level?.slice(0, 80) ?? null,
    preferred_categories: profile.preferred_categories?.slice(0, 3) ?? [],
    preferred_format: profile.preferred_format ?? "any",
    budget_min: profile.budget_min ?? null,
    budget_max: profile.budget_max ?? null,
    location_preference: profile.location_preference?.slice(0, 120) ?? null,
    schedule_preference: profile.schedule_preference?.slice(0, 120) ?? null,
    learning_style: profile.learning_style?.slice(0, 120) ?? null,
    notes: profile.notes?.slice(0, 160) ?? null,
  };
}

async function fetchLearningProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("learner_learning_profiles")
    .select("primary_goal, current_level, preferred_categories, preferred_format, budget_min, budget_max, location_preference, schedule_preference, learning_style, notes")
    .eq("learner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("learner_learning_profiles fetch error:", { message: error.message, code: error.code });
    return null;
  }

  return (data ?? null) as LearningProfile | null;
}

async function isLearnerUser(userId: string) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");
  const { data, error } = await serviceClient.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.role !== "mentor";
}

async function reserveAiUsage(
  supabase: ReturnType<typeof createClient>,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    _feature: "roadmap",
    _credits: ROADMAP_CREDIT_COST,
    _prompt_preview: promptPreview.slice(0, 500),
    _metadata: metadata,
  });
  if (error) throw error;

  const result = normalizeReserveResult(data);
  if (!result.ok) {
    return {
      ok: false,
      usageLogId: null,
      response: jsonResponse(
        {
          error: true,
          code: "AI_CREDIT_REQUIRED",
          reason: result.reason,
          creditsRemaining: result.creditsRemaining,
          upgradeUrl: "/pricing",
        },
        402,
      ),
    };
  }
  return { ok: true, usageLogId: result.usageLogId, response: null };
}

async function finalizeAiUsage(
  supabase: ReturnType<typeof createClient>,
  usageLogId: string | null,
  status: "success" | "failed",
  errorMessage: string | null,
) {
  if (!usageLogId) return;
  const { error } = await supabase.rpc("finalize_ai_usage", {
    _usage_log_id: usageLogId,
    _status: status,
    _error_message: errorMessage,
  });
  if (error) console.error("finalize_ai_usage error:", { message: error.message, code: error.code });
}

async function updateAiUsageMetadata(usageLogId: string | null, metadata: Record<string, unknown>) {
  if (!usageLogId) return;
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;

  const { data: existingLog } = await serviceClient.from("ai_usage_logs").select("metadata").eq("id", usageLogId).maybeSingle();
  const existingMetadata =
    existingLog?.metadata && typeof existingLog.metadata === "object" && !Array.isArray(existingLog.metadata)
      ? existingLog.metadata as Record<string, unknown>
      : {};

  const { error } = await serviceClient
    .from("ai_usage_logs")
    .update({ metadata: { ...existingMetadata, ...metadata } })
    .eq("id", usageLogId);
  if (error) console.error("ai_usage_logs metadata update error:", { message: error.message, code: error.code });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function detectCategory(goal: string): CourseCategory | null {
  const text = normalizeText(goal);
  const rules: Array<[CourseCategory, string[]]> = [
    ["mind-sports", ["co vua", "co tuong", "chess", "chien thuat", "tu duy"]],
    ["career-english", ["tieng anh", "english", "ielts", "toeic", "giao tiep"]],
    ["modern-sports", ["the thao", "yoga", "pickleball", "tennis", "gym", "boi"]],
    ["barista-beverage", ["barista", "ca phe", "coffee", "pha che", "do uong"]],
    ["content-speaking", ["mc", "thuyet trinh", "noi dung", "content", "presentation"]],
    ["ai-productivity", ["ai", "cong cu", "nang suat", "automation", "lap trinh", "coding"]],
  ];
  return rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? null;
}

function firstValidProfileCategory(profile: LearningProfile | null) {
  const preferred = profile?.preferred_categories?.find((value) =>
    VALID_CATEGORIES.includes(value as CourseCategory),
  );
  return preferred ? preferred as CourseCategory : null;
}

function extractKeywords(goal: string) {
  const stopWords = new Set(["toi", "muon", "hoc", "trong", "tuan", "de", "cho", "can", "va", "voi", "mot"]);
  return normalizeText(goal)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 12);
}

function scoreCourse(course: RoadmapCourse, keywords: string[]) {
  const text = normalizeText(`${course.title} ${course.description ?? ""} ${course.category ?? ""}`);
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  return hits * 10 + Number(course.rating ?? 0) * 2 + Math.min(Number(course.review_count ?? 0), 50) / 5;
}

async function fetchCandidateCourses(params: {
  goal: string;
  category: CourseCategory | null;
  preferredFormat: PreferredFormat;
  budget: number | null;
}) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");

  let query = serviceClient
    .from("courses")
    .select("id, title, description, category, format, price, location, rating, review_count, mentor:profiles!courses_mentor_id_fkey(name)")
    .eq("status", "approved")
    .eq("is_hidden", false)
    .order("rating", { ascending: false })
    .limit(40);

  if (params.category) query = query.eq("category", params.category);
  if (params.preferredFormat !== "any") query = query.eq("format", params.preferredFormat);
  if (params.budget && params.budget > 0) query = query.lte("price", params.budget);

  const { data, error } = await query;
  if (error) throw error;

  const keywords = extractKeywords(params.goal);
  return ((data ?? []) as RoadmapCourse[])
    .sort((a, b) => scoreCourse(b, keywords) - scoreCourse(a, keywords))
    .slice(0, 8);
}

function publicCourse(course: RoadmapCourse) {
  return {
    id: course.id,
    title: course.title,
    description: String(course.description ?? "").slice(0, 220),
    category: course.category,
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    mentor_name: course.mentor?.name ?? "Mentor",
  };
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI output is not valid JSON.");
  }
}

function list(value: unknown, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, limit);
}

function clampWeeks(value: unknown, fallback = 8) {
  const weeks = Number(value);
  if (!Number.isFinite(weeks)) return fallback;
  return Math.max(2, Math.min(24, Math.round(weeks)));
}

function fallbackRoadmapByCategory(
  category: CourseCategory,
  goal: string,
  durationWeeks: number,
  courses: RoadmapCourse[],
  reason?: string,
): RoadmapResult {
  const config = CATEGORY_ROADMAPS[category];
  const planLength = Math.min(durationWeeks, 12);
  const recommendedCourses = courses.slice(0, 3);

  return {
    roadmap_title: config.title,
    goal_summary: `${config.label}: lộ trình theo tuần cho mục tiêu "${goal}". ${
      recommendedCourses.length ? "Các khóa gợi ý chỉ dùng course_id có trong database VET." : NO_COURSE_MESSAGE
    }${reason ? ` Ghi chú hệ thống: ${reason}` : ""}`,
    estimated_duration_weeks: durationWeeks,
    weekly_plan: Array.from({ length: planLength }).map((_, index) => {
      const template = config.weeks[index % config.weeks.length];
      const course = recommendedCourses[index % Math.max(1, recommendedCourses.length)];
      const phaseSuffix = index >= config.weeks.length ? ` - vòng nâng cao ${Math.floor(index / config.weeks.length) + 1}` : "";
      return {
        week: index + 1,
        focus: `${template.focus}${phaseSuffix}`,
        tasks: template.tasks,
        practice_assignment: template.practice_assignment,
        milestone: template.milestone,
        suggested_course_ids: course?.id ? [course.id] : [],
      };
    }),
    recommended_courses: recommendedCourses.map((course) => ({
      course_id: course.id,
      reason: config.courseReason,
    })),
    study_tips: config.studyTips,
    next_step: recommendedCourses.length
      ? config.nextStep
      : `${NO_COURSE_MESSAGE} Trong lúc đó, hãy bắt đầu bằng các bài thực hành trong lộ trình này.`,
  };
}

function fallbackRoadmap(goal: string, durationWeeks: number, courses: RoadmapCourse[], reason?: string): RoadmapResult {
  const planLength = Math.min(durationWeeks, 8);
  const recommendedCourses = courses.slice(0, 3);
  return {
    roadmap_title: "Lộ trình học cá nhân hóa",
    goal_summary: reason
      ? `VET tạo lộ trình tham khảo cho mục tiêu: ${goal}`
      : `Lộ trình giúp bạn tiến gần hơn đến mục tiêu: ${goal}`,
    estimated_duration_weeks: durationWeeks,
    weekly_plan: Array.from({ length: planLength }).map((_, index) => ({
      week: index + 1,
      focus: index === 0 ? "Xác định nền tảng và mục tiêu cụ thể" : `Thực hành và củng cố giai đoạn ${index + 1}`,
      tasks: [
        "Dành 2-3 buổi học ngắn trong tuần.",
        "Ghi lại điểm chưa hiểu để hỏi mentor.",
        "Tự đánh giá tiến độ cuối tuần.",
      ],
      suggested_course_ids: recommendedCourses[index % Math.max(1, recommendedCourses.length)]?.id
        ? [recommendedCourses[index % Math.max(1, recommendedCourses.length)].id]
        : [],
    })),
    recommended_courses: recommendedCourses.map((course) => ({
      course_id: course.id,
      reason: "Khóa học này gần với mục tiêu và bộ lọc bạn nhập.",
    })),
    study_tips: [
      "Giữ lịch học cố định hằng tuần.",
      "Hỏi mentor trước khi đặt lịch nếu bạn chưa chắc trình độ phù hợp.",
      "Đặt mục tiêu nhỏ theo từng tuần thay vì kỳ vọng kết quả ngay.",
    ],
    next_step: recommendedCourses.length
      ? "Chọn một khóa phù hợp nhất và trao đổi với mentor trước khi đặt lịch."
      : "Hãy thử mở rộng danh mục, ngân sách hoặc hình thức học để tìm khóa phù hợp hơn.",
  };
}

function validateRoadmap(raw: unknown, candidates: RoadmapCourse[], fallback: RoadmapResult): RoadmapResult {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const validIds = new Set(candidates.map((course) => course.id));
  const weeks = clampWeeks(payload.estimated_duration_weeks, fallback.estimated_duration_weeks);
  const weeklyRaw = Array.isArray(payload.weekly_plan) ? payload.weekly_plan : [];
  const recommendedRaw = Array.isArray(payload.recommended_courses) ? payload.recommended_courses : [];

  const targetWeekCount = Math.min(weeks, 12);
  const weekly_plan = Array.from({ length: targetWeekCount }).map((_, index) => {
    const record = (weeklyRaw[index] ?? {}) as Record<string, unknown>;
    const fallbackWeek = fallback.weekly_plan[index] ?? fallback.weekly_plan[index % Math.max(1, fallback.weekly_plan.length)];
    const tasks = list(record.tasks, 5);
    return {
      week: Number.isFinite(Number(record.week)) ? Number(record.week) : index + 1,
      focus: String(record.focus ?? fallbackWeek?.focus ?? `Tuần ${index + 1}`).slice(0, 180),
      tasks: tasks.length ? tasks : fallbackWeek?.tasks ?? [],
      practice_assignment: String(record.practice_assignment ?? fallbackWeek?.practice_assignment ?? "").slice(0, 320),
      milestone: String(record.milestone ?? fallbackWeek?.milestone ?? "").slice(0, 260),
      suggested_course_ids: list(record.suggested_course_ids, 4).filter((id) => validIds.has(id)),
    };
  }).filter((row) => row.focus && row.tasks.length);

  const recommended_courses = recommendedRaw.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const id = String(record.course_id ?? "");
    if (!validIds.has(id)) return [];
    return [{ course_id: id, reason: String(record.reason ?? "").slice(0, 240) }];
  }).slice(0, 5);

  if (!weekly_plan.length) throw new Error("AI roadmap is missing weekly plan.");

  return {
    roadmap_title: String(payload.roadmap_title ?? fallback.roadmap_title).slice(0, 160),
    goal_summary: String(payload.goal_summary ?? fallback.goal_summary).slice(0, 600),
    estimated_duration_weeks: weeks,
    weekly_plan,
    recommended_courses,
    study_tips: list(payload.study_tips, 6).length ? list(payload.study_tips, 6) : fallback.study_tips,
    next_step: String(payload.next_step ?? fallback.next_step).slice(0, 500),
  };
}

function buildPrompt(params: {
  goal: string;
  category: CourseCategory | null;
  level: Level;
  durationWeeks: number;
  preferredFormat: PreferredFormat;
  budget: number | null;
  learningProfile: LearningProfile | null;
  courses: RoadmapCourse[];
}) {
  const category = params.category ?? "ai-productivity";
  const categoryGuide = CATEGORY_ROADMAPS[category];
  const noCourseInstruction = params.courses.length
    ? "Use recommended_courses only when a candidate is genuinely useful."
    : `${NO_COURSE_MESSAGE} Because candidate_courses is empty, recommended_courses must be [].`;

  return `Learner roadmap request:
${JSON.stringify({
    goal: params.goal,
    category,
    category_label: categoryGuide.label,
    level: params.level,
    duration_weeks: params.durationWeeks,
    preferred_format: params.preferredFormat,
    budget: params.budget,
  })}

Category-specific roadmap requirements:
${JSON.stringify({
    category,
    must_cover: categoryGuide.modules,
    example_week_topics: categoryGuide.weeks.map((week) => ({
      focus: week.focus,
      practice_assignment: week.practice_assignment,
      milestone: week.milestone,
    })),
  })}

Saved learner learning profile, use only as secondary context and never override explicit roadmap request:
${JSON.stringify(learningProfileContext(params.learningProfile))}

Candidate courses from VET database:
${JSON.stringify(params.courses.map(publicCourse))}

Rules:
- Build a learning roadmap only from the learner goal and candidate courses above.
- The roadmap must be specific to category "${category}" (${categoryGuide.label}); do not write generic advice that could fit every category.
- Each week must include concrete tasks, one practice_assignment, and one milestone.
- Avoid generic tasks like "study 2-3 sessions", "write down questions", or "self-assess progress" unless tied to a concrete category activity.
- Do not invent courses. Course IDs in suggested_course_ids and recommended_courses must come from candidates.
- ${noCourseInstruction}
- Do not promise guaranteed outcomes, refunds, payment results, medical/legal/financial advice, or unavailable schedules.
- It is okay to include general self-study tasks.
- Respond in Vietnamese.
- Respond only as valid JSON:
{
  "roadmap_title": string,
  "goal_summary": string,
  "estimated_duration_weeks": number,
  "weekly_plan": [
    {
      "week": number,
      "focus": string,
      "tasks": string[],
      "practice_assignment": string,
      "milestone": string,
      "suggested_course_ids": string[]
    }
  ],
  "recommended_courses": [
    { "course_id": string, "reason": string }
  ],
  "study_tips": string[],
  "next_step": string
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const goal = String(body.goal ?? "").trim().slice(0, 500);
    if (!goal) return jsonResponse({ error: true, message: "Vui lòng nhập mục tiêu học tập." }, 400);

    const categoryInput = body.category ? String(body.category).trim() : "";
    if (categoryInput && !VALID_CATEGORIES.includes(categoryInput as CourseCategory)) {
      return jsonResponse({ error: true, message: "Danh mục không hợp lệ." }, 400);
    }

    let category = (categoryInput as CourseCategory) || detectCategory(goal);
    const level: Level = ["beginner", "intermediate", "advanced", "unknown"].includes(String(body.level))
      ? body.level
      : "unknown";
    let preferredFormat: PreferredFormat = ["online", "offline", "any"].includes(String(body.preferred_format))
      ? body.preferred_format
      : "any";
    const durationWeeks = clampWeeks(body.duration_weeks, 8);
    let budget = Number.isFinite(Number(body.budget)) && Number(body.budget) > 0 ? Number(body.budget) : null;

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    supabaseForFinalize = supabase;

    if (!(await isLearnerUser(userId))) {
      return jsonResponse({ error: true, code: "LEARNER_REQUIRED", message: "Chỉ learner mới có thể tạo lộ trình AI." }, 403);
    }

    const learningProfile = await fetchLearningProfile(supabase, userId);
    category = category ?? firstValidProfileCategory(learningProfile);
    const roadmapCategory: CourseCategory = category ?? "ai-productivity";
    preferredFormat = preferredFormat !== "any"
      ? preferredFormat
      : learningProfile?.preferred_format === "online" || learningProfile?.preferred_format === "offline"
        ? learningProfile.preferred_format
        : preferredFormat;
    budget = budget ?? learningProfile?.budget_max ?? null;

    const courses = await fetchCandidateCourses({ goal, category: roadmapCategory, preferredFormat, budget });

    const reservation = await reserveAiUsage(supabase, goal, {
      function: "ai-roadmap",
      feature: "roadmap",
      category: roadmapCategory,
      provider: "gemini",
      candidate_count: courses.length,
      learning_profile_used: Boolean(learningProfile),
      profile_preferred_categories: learningProfile?.preferred_categories?.slice(0, 3) ?? [],
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const fallback = fallbackRoadmapByCategory(roadmapCategory, goal, durationWeeks, courses);

    try {
      const aiResult = await callAI({
        task: "roadmap",
        modelTier: "main",
        systemPrompt: "Bạn là AI Roadmap của VET. Hãy tạo lộ trình học thực tế, an toàn, không bịa khóa học và không cam kết kết quả.",
        prompt: buildPrompt({ goal, category: roadmapCategory, level, durationWeeks, preferredFormat, budget, learningProfile, courses }),
        responseMimeType: "application/json",
        maxOutputTokens: 1700,
        temperature: 0.35,
      });

      await finalizeAiUsage(supabase, usageLogId, "success", null);

      try {
        const roadmap = validateRoadmap(parseJson(aiResult.text), courses, fallback);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "roadmap",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: false,
          category: roadmapCategory,
          candidate_count: courses.length,
          result_summary: roadmap.goal_summary,
        });
        return jsonResponse({ roadmap, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: ROADMAP_CREDIT_COST });
      } catch (parseError) {
        const roadmap = fallbackRoadmapByCategory(roadmapCategory, goal, durationWeeks, courses, "invalid_ai_json");
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "roadmap",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: true,
          fallback_reason: "invalid_ai_json",
          parse_error: parseError instanceof Error ? parseError.message : "invalid_ai_output",
          category: roadmapCategory,
          candidate_count: courses.length,
          result_summary: roadmap.goal_summary,
        });
        return jsonResponse({ roadmap, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: ROADMAP_CREDIT_COST, fallback: true });
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI provider error";
      console.error("ai-roadmap provider error:", message);
      await finalizeAiUsage(supabase, usageLogId, "failed", message);
      await updateAiUsageMetadata(usageLogId, {
        task: "roadmap",
        fallback: true,
        fallback_reason: "ai_error",
        category: roadmapCategory,
        candidate_count: courses.length,
        result_summary: "AI Roadmap gặp lỗi, credit sẽ được hoàn qua hệ thống.",
      });
      return jsonResponse({ error: true, message: "Không thể tạo lộ trình AI lúc này. Credit sẽ được hoàn nếu AI gặp lỗi.", credit_refunded: true }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI Roadmap error";
    console.error("ai-roadmap error:", message);
    if (supabaseForFinalize && usageLogId) await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    return jsonResponse({ error: true, message: "Không thể tạo lộ trình AI lúc này. Vui lòng thử lại sau." }, 500);
  }
});
