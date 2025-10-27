type DashboardLayoutProps = {
  children: React.ReactNode
}


export default function DashboardLayout({children}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* 左ナビゲーション */}
        <aside className="w-64 bg-white shadow-md p-6 border-r border-gray-200">
            <h2 className="text-2xl font-bold text-blue-600 mb-6">LOL Coach AI</h2>
            <nav className="flex flex-col gap-4 text-gray-700">
                <a href="/dashboard" className="hover:text-blue-500 font-medium">ダッシュボード</a>
                <a href="/video" className="hover:text-blue-500 font-medium">動画解析</a>
                <a href="/chat" className="hover:text-blue-500 font-medium">サモナー解析</a>
            </nav>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
