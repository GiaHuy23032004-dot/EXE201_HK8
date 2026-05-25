import { useQuery } from "@tanstack/react-query";
import { fetchMentorStudentDetail } from "@/hooks/useMentorStudents";

export function useMentorStudentDetail(
  mentorId: string | undefined,
  learnerId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["mentor-student-detail", mentorId, learnerId],
    enabled: enabled && !!mentorId && !!learnerId,
    queryFn: () => fetchMentorStudentDetail(mentorId!, learnerId!),
  });
}
