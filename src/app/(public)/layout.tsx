import PublicHeader from "./components/PublicHeader";
import Footer from "@/app/Components/layout/Footer";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-300 font-sans selection:bg-cyan-500 selection:text-black flex flex-col">
            <PublicHeader />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </div>
    );
}
