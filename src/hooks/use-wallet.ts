import { useMutation } from "@tanstack/react-query";
import { useMentorWallet as useMentorWalletQuery } from "@/hooks/useMentorWallet";
import { useMentorWalletHistory } from "@/hooks/useMentorWalletHistory";
import { useMentorWithdrawals, useCreateWithdrawalRequest } from "@/hooks/useMentorWithdrawals";

export { useMentorWithdrawals, useCreateWithdrawalRequest };
export type { MentorWallet } from "@/hooks/useMentorWallet";
export type { MentorWalletTransaction, MentorRevenueTransaction as MentorTransaction } from "@/hooks/useMentorWalletHistory";
export type { MentorWithdrawal } from "@/hooks/useMentorWithdrawals";

export function useMentorWallet(_mentorId?: string) {
  return useMentorWalletQuery();
}

export function useWalletTransactions(_mentorId?: string) {
  const history = useMentorWalletHistory();
  return {
    ...history,
    data: history.data?.walletTransactions ?? [],
  };
}

export function useMentorTransactions(_mentorId?: string) {
  const history = useMentorWalletHistory();
  return {
    ...history,
    data: history.data?.transactions ?? [],
  };
}

// Legacy dashboard compatibility. New withdrawals require selecting a payout method
// and must be created via useCreateWithdrawalRequest on /mentor/wallet.
export function useCreateWithdrawal() {
  return useMutation({
    mutationFn: async (_payload?: unknown) => {
      throw new Error("Vui lòng tạo yêu cầu rút tiền tại trang Doanh thu & Ví.");
    },
  });
}
