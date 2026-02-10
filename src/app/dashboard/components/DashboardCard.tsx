export default function DashboardCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`glass-panel rounded-xl p-4 h-full flex flex-col ${className}`}>
            {children}
        </div>
    );
}
