export default function DashboardCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col ${className}`}>
            {children}
        </div>
    );
}
