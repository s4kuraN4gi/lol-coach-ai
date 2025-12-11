'use client' // Error components must be Client Components

import { useEffect } from 'react'
import DashboardLayout from '@/app/Components/layout/DashboardLayout'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong!</h2>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded mb-6 max-w-2xl overflow-auto text-left">
                <p className="font-mono text-sm text-slate-300 whitespace-pre-wrap">
                    {error.message || "Unknown error occurred"}
                </p>
                {error.digest && (
                    <p className="font-mono text-xs text-slate-500 mt-2">
                        Digest: {error.digest}
                    </p>
                )}
            </div>
            <button
                onClick={
                // Attempt to recover by trying to re-render the segment
                () => reset()
                }
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition"
            >
                Try again
            </button>
        </div>
    </DashboardLayout>
  )
}
