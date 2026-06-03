import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateMentorPayoutMethod, type CreatePayoutMethodPayload } from "@/hooks/useMentorPayoutMethods";

const initialForm: CreatePayoutMethodPayload = {
  method_type: "bank_transfer",
  provider_name: "",
  provider_code: "",
  account_number: "",
  account_holder: "",
  branch: "",
  nickname: "",
  is_default: false,
  confirmed: false,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể thêm phương thức nhận tiền.";
}

export function PayoutMethodDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createMethod = useCreateMentorPayoutMethod();
  const [form, setForm] = useState<CreatePayoutMethodPayload>(initialForm);

  useEffect(() => {
    if (!open) setForm(initialForm);
  }, [open]);

  const set = <K extends keyof CreatePayoutMethodPayload>(key: K, value: CreatePayoutMethodPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.provider_name.trim() || !form.account_number.trim() || !form.account_holder.trim()) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng nhập nhà cung cấp, số tài khoản và chủ tài khoản.", variant: "destructive" });
      return;
    }

    if (!form.confirmed) {
      toast({ title: "Cần xác nhận", description: "Vui lòng xác nhận thông tin nhận tiền là chính xác.", variant: "destructive" });
      return;
    }

    try {
      await createMethod.mutateAsync(form);
      toast({ title: "Đã thêm phương thức nhận tiền." });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Không thể thêm phương thức nhận tiền.", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Thêm phương thức nhận tiền
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Loại phương thức</Label>
            <Select value={form.method_type} onValueChange={(value) => set("method_type", value as "bank_transfer" | "e_wallet")}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Chuyển khoản ngân hàng</SelectItem>
                <SelectItem value="e_wallet">Ví điện tử</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ngân hàng / Nhà cung cấp</Label>
              <Input className="rounded-xl" value={form.provider_name} onChange={(event) => set("provider_name", event.target.value)} placeholder="VD: Vietcombank" />
            </div>
            <div className="space-y-2">
              <Label>Mã nhà cung cấp (tùy chọn)</Label>
              <Input className="rounded-xl" value={form.provider_code ?? ""} onChange={(event) => set("provider_code", event.target.value)} placeholder="VD: VCB" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Số tài khoản / Số ví</Label>
              <Input className="rounded-xl" value={form.account_number} onChange={(event) => set("account_number", event.target.value)} placeholder="0123456789" />
            </div>
            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input className="rounded-xl uppercase" value={form.account_holder} onChange={(event) => set("account_holder", event.target.value)} placeholder="NGUYEN VAN A" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Chi nhánh (tùy chọn)</Label>
              <Input className="rounded-xl" value={form.branch ?? ""} onChange={(event) => set("branch", event.target.value)} placeholder="TP.HCM" />
            </div>
            <div className="space-y-2">
              <Label>Tên gợi nhớ (tùy chọn)</Label>
              <Input className="rounded-xl" value={form.nickname ?? ""} onChange={(event) => set("nickname", event.target.value)} placeholder="Tài khoản chính" />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <Checkbox checked={form.is_default} onCheckedChange={(checked) => set("is_default", checked === true)} />
            Đặt làm phương thức mặc định
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <Checkbox checked={form.confirmed} onCheckedChange={(checked) => set("confirmed", checked === true)} />
            <span>Tôi xác nhận thông tin nhận tiền là chính xác.</span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Hủy</Button>
          <Button onClick={handleSubmit} disabled={createMethod.isPending} className="rounded-xl border-0 gradient-primary text-primary-foreground">
            {createMethod.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Thêm phương thức
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
