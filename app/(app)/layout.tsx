import TopBar from "@/components/top-bar";
import BottomNav from "@/components/bottom-nav";
import ComposeSheet from "@/components/compose-sheet";
import ShareSheet from "@/components/share-sheet";
import AgeGate from "@/components/age-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <TopBar />
      <main className="relative z-10 w-full max-w-[560px] mx-auto px-4 pt-[68px] pb-[108px]">
        {children}
      </main>
      <BottomNav />
      <ComposeSheet />
      <ShareSheet />
      <AgeGate />
    </div>
  );
}
