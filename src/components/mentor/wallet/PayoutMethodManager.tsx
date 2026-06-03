import { useState } from "react";
import { CreditCard, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  maskAccountNumber,
  useDeleteMentorPayoutMethod,
  useSetDefaultMentorPayoutMethod,
  type MentorPayoutMethod,
} from "@/hooks/useMentorPayoutMethods";
import { StatusBadge } from "./StatusBadge";
import { PayoutMethodDialog } from "./PayoutMethodDialog";

function getMethodLabel(type: string) {
  if (type === "bank_transfer") return "Chuyển khoản ngân hàng";
  if (type === "e_wallet") return "Ví điện tử";
  return type;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể xử lý phương thức nhận tiền.";
}

export function PayoutMethodManager({
  methods,
  isLoading,
}: {
  methods: MentorPayoutMethod[];
  isLoading?: boolean;
}) {
  const { toast } = useToast();
  const setDefault = useSetDefaultMentorPayoutMethod();
  const deleteMethod = useDeleteMentorPayoutMethod();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MentorPayoutMethod | null>(null);

  const handleSetDefault = async (method: MentorPayoutMethod) => {
    try {
      await setDefault.mutateAsync(method.id);
      toast({ title: "Đã đặt phương thức mặc định." });
    } catch (error) {
      toast({ title: "Không thể đặt mặc định", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMethod.mutateAsync(deleteTarget.id);
      toast({ title: "Đã xóa phương thức nhận tiền." });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Không thể xóa phương thức", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Phương thức nhận tiền</h2>
          <p className="text-sm text-muted-foreground">Thêm hoặc quản lý tài khoản nhận tiền khi rút ví.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl border-0 gradient-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Thêm phương thức
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="rounded-2xl">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : methods.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">Chưa có phương thức nhận tiền</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Bạn cần thêm phương thức nhận tiền trước khi tạo yêu cầu rút tiền.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-xl border-0 gradient-primary text-primary-foreground">
              Thêm phương thức nhận tiền
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {methods.map((method) => (
            <Card key={method.id} className="rounded-2xl shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>{method.nickname || method.provider_name}</span>
                  <div className="flex flex-wrap justify-end gap-2">
                    {method.is_default && <Badge className="rounded-full border-0 bg-primary/10 text-primary">Mặc định</Badge>}
                    <StatusBadge status={method.status} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-sm font-medium text-foreground">{getMethodLabel(method.method_type)}</p>
                  <p className="text-sm text-muted-foreground">{method.provider_name}</p>
                  <p className="mt-2 font-mono text-lg font-semibold text-foreground">{maskAccountNumber(method.account_number)}</p>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Chủ tài khoản</span>
                    <span className="text-right font-medium text-foreground">{method.account_holder}</span>
                  </div>
                  {method.branch && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Chi nhánh</span>
                      <span className="text-right text-foreground">{method.branch}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Ngày thêm</span>
                    <span className="text-right text-foreground">{new Date(method.created_at).toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(method)}
                      disabled={setDefault.isPending}
                      className="rounded-xl"
                    >
                      {setDefault.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Star className="mr-2 h-3.5 w-3.5" />}
                      Đặt mặc định
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(method)}
                    className="rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PayoutMethodDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phương thức nhận tiền?</AlertDialogTitle>
            <AlertDialogDescription>
              Nếu đang có yêu cầu rút tiền chờ xử lý sử dụng phương thức này, hệ thống có thể từ chối thao tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
