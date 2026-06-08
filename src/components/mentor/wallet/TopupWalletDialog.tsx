import { useState } from "react";
import { Copy, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TopupWalletDialogProps {
  open: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [50_000, 100_000, 200_000, 500_000];

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TopupWalletDialog({ open, onClose }: TopupWalletDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(100_000);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [transferContent, setTransferContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveAmount = customAmount ? parseInt(customAmount.replace(/\D/g, ""), 10) || 0 : amount;

  const handleGenerateQR = async () => {
    if (effectiveAmount < 10_000) {
      toast({
        title: "Số tiền tối thiểu là 10.000đ",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mentor-topup", {
        body: { amount: effectiveAmount },
      });
      if (error) throw error;
      setQrUrl(data.qr_url);
      setTransferContent(data.transfer_content);
    } catch (err) {
      toast({
        title: "Không thể tạo QR",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!transferContent) return;
    navigator.clipboard.writeText(transferContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setQrUrl(null);
    setTransferContent(null);
    setCustomAmount("");
    setAmount(100_000);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Nạp tiền vào ví</DialogTitle>
        </DialogHeader>

        {!qrUrl ? (
          <div className="space-y-5">
            {/* Preset buttons */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Chọn số tiền nạp</Label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => { setAmount(preset); setCustomAmount(""); }}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                      amount === preset && !customAmount
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-foreground hover:bg-muted"
                    }`}
                  >
                    {formatVND(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Hoặc nhập số tiền tùy chọn</Label>
              <Input
                value={customAmount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setCustomAmount(raw);
                  if (raw) setAmount(0);
                }}
                placeholder="VD: 150000"
                className="rounded-xl"
                type="text"
                inputMode="numeric"
              />
              {customAmount && (
                <p className="mt-1 text-xs text-muted-foreground">
                  = {formatVND(parseInt(customAmount, 10) || 0)}
                </p>
              )}
            </div>

            {/* Info box */}
            <div className="flex gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Tiền nạp sẽ được cộng vào ví sau khi hệ thống xác nhận chuyển khoản.
                Số dư ví dùng để thanh toán phí quảng cáo khóa học.
              </p>
            </div>

            <Button
              onClick={handleGenerateQR}
              disabled={loading || effectiveAmount < 10_000}
              className="w-full rounded-xl border-0 gradient-primary text-primary-foreground"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo QR nạp tiền
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* QR code */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Quét mã QR để chuyển khoản</p>
              <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                <img
                  src={qrUrl}
                  alt="QR nạp tiền"
                  className="h-52 w-52 object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Mở app ngân hàng hoặc ví điện tử hỗ trợ VietQR
              </p>
            </div>

            {/* Transfer info */}
            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngân hàng</span>
                <span className="font-medium">MB Bank</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tài khoản</span>
                <span className="font-medium">0909659291</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chủ TK</span>
                <span className="font-medium">DOAN GIA HUY</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-semibold text-primary">{formatVND(effectiveAmount)}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Nội dung CK</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80"
                  >
                    {copied ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Đã sao chép</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Sao chép</>
                    )}
                  </button>
                </div>
                <div className="rounded-lg bg-yellow-50 px-3 py-2 font-mono text-xs font-bold text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
                  {transferContent}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/30 dark:text-orange-400">
              ⚠️ Nhập <strong>đúng nội dung chuyển khoản</strong> để hệ thống tự động cộng tiền vào ví.
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 rounded-xl"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Tạo lại
              </Button>
              <Button
                onClick={handleClose}
                className="flex-1 rounded-xl border-0 gradient-primary text-primary-foreground"
              >
                Đã chuyển khoản
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
