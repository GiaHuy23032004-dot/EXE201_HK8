import { Link } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AiCreditUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiCreditUpgradeDialog({ open, onOpenChange }: AiCreditUpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle>Bạn đã hết AI credits</DialogTitle>
          <DialogDescription>
            Nâng cấp VET Plus để nhận 60 AI credits mỗi tháng và 2 voucher booking.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Link to="/pricing" onClick={() => onOpenChange(false)}>
            <Button className="rounded-xl border-0 bg-[linear-gradient(135deg,#0369a1_0%,#0891b2_48%,#0f766e_100%)] text-white shadow-lg shadow-primary/25 hover:brightness-110">
              <Crown className="mr-2 h-4 w-4" />
              Xem VET Plus
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
