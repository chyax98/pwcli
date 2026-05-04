import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <Header />
      <main
        id="main-content"
        className="ml-56 pt-14 min-h-screen"
        aria-label="Main content"
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
