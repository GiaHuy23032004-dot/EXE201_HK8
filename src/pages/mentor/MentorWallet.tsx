import { useMemo } from "react";
import { ArrowDownToLine, CreditCard, History, Wallet } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayoutMethodManager } from "@/components/mentor/wallet/PayoutMethodManager";
import { WalletHistoryTable } from "@/components/mentor/wallet/WalletHistoryTable";
import { WalletOverview } from "@/components/mentor/wallet/WalletOverview";
import { WithdrawalHistoryTable } from "@/components/mentor/wallet/WithdrawalHistoryTable";
import { WithdrawalRequestPanel } from "@/components/mentor/wallet/WithdrawalRequestPanel";
import { useMentorPayoutMethods } from "@/hooks/useMentorPayoutMethods";
import { useMentorWallet } from "@/hooks/useMentorWallet";
import { useMentorWalletHistory } from "@/hooks/useMentorWalletHistory";
import { useMentorWithdrawals } from "@/hooks/useMentorWithdrawals";

const VALID_TABS = new Set(["overview", "payout-methods", "withdraw", "history"]);

export default function MentorWalletPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") ?? "overview";
  const activeTab = VALID_TABS.has(tabFromUrl) ? tabFromUrl : "overview";

  const walletQuery = useMentorWallet();
  const payoutMethodsQuery = useMentorPayoutMethods();
  const withdrawalsQuery = useMentorWithdrawals();
  const historyQuery = useMentorWalletHistory();

  const wallet = walletQuery.data;
  const payoutMethods = payoutMethodsQuery.data ?? [];
  const withdrawals = withdrawalsQuery.data ?? [];
  const walletTransactions = historyQuery.data?.walletTransactions ?? [];
  const transactions = historyQuery.data?.transactions ?? [];

  const pendingWithdrawalAmount = useMemo(
    () => withdrawals
      .filter((withdrawal) => withdrawal.status === "pending")
      .reduce((total, withdrawal) => total + withdrawal.amount, 0),
    [withdrawals],
  );

  const platformFees = useMemo(
    () => transactions
      .filter((transaction) => transaction.status === "success")
      .reduce((total, transaction) => total + transaction.platform_fee, 0),
    [transactions],
  );

  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Doanh thu & Ví</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi doanh thu, phương thức nhận tiền và yêu cầu rút tiền của bạn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setActiveTab("payout-methods")}
              className="rounded-xl"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Phương thức nhận tiền
            </Button>
            <Button
              onClick={() => setActiveTab("withdraw")}
              className="rounded-xl border-0 gradient-primary text-primary-foreground"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Rút tiền
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/70 p-1 md:grid-cols-4">
            <TabsTrigger value="overview" className="rounded-xl">
              <Wallet className="mr-2 h-4 w-4" />
              Tổng quan
            </TabsTrigger>
            <TabsTrigger value="payout-methods" className="rounded-xl">
              <CreditCard className="mr-2 h-4 w-4" />
              Nhận tiền
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="rounded-xl">
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Rút tiền
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl">
              <History className="mr-2 h-4 w-4" />
              Lịch sử
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <WalletOverview
              totalEarned={wallet?.total_earned ?? 0}
              balance={wallet?.balance ?? 0}
              heldBalance={wallet?.held_balance ?? 0}
              pendingWithdrawals={pendingWithdrawalAmount}
              platformFees={platformFees}
              isLoading={walletQuery.isLoading || withdrawalsQuery.isLoading || historyQuery.isLoading}
            />
            <div className="grid gap-5 xl:grid-cols-2">
              <WithdrawalHistoryTable
                withdrawals={withdrawals.slice(0, 5)}
                isLoading={withdrawalsQuery.isLoading}
              />
              <WalletHistoryTable
                walletTransactions={walletTransactions.slice(0, 5)}
                transactions={transactions.slice(0, 5)}
                isLoading={historyQuery.isLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="payout-methods">
            <PayoutMethodManager
              methods={payoutMethods}
              isLoading={payoutMethodsQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-5">
            <WithdrawalRequestPanel
              wallet={wallet}
              payoutMethods={payoutMethods}
              withdrawals={withdrawals}
              isLoading={walletQuery.isLoading || payoutMethodsQuery.isLoading}
              onManagePayoutMethods={() => setActiveTab("payout-methods")}
            />
            <WithdrawalHistoryTable
              withdrawals={withdrawals}
              isLoading={withdrawalsQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="history">
            <WalletHistoryTable
              walletTransactions={walletTransactions}
              transactions={transactions}
              isLoading={historyQuery.isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MentorLayout>
  );
}
