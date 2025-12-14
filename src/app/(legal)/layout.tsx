export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500 selection:text-white">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
         <header className="mb-12 border-b border-slate-800 pb-6">
             <a href="/" className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-amber-300 hover:opacity-80 transition">
                 LoL Coach AI
             </a>
         </header>
         <main className="prose prose-invert prose-blue max-w-none">
            {children}
         </main>
         <footer className="mt-20 pt-8 border-t border-slate-800 text-center text-slate-600 text-sm">
            <p>&copy; {new Date().getFullYear()} LoL Coach AI. All rights reserved.</p>
         </footer>
      </div>
    </div>
  );
}
