import { Navigate } from "react-router-dom";

export default function MentorVerification() {
  return <Navigate to="/mentor/profile?tab=verification" replace />;
}
