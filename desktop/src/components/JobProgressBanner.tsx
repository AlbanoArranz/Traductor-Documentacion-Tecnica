import { RefreshCw } from 'lucide-react'

interface JobProgressBannerProps {
  jobId: string | null
  progress: number
  step: string
}

export function JobProgressBanner({ jobId, progress, step }: JobProgressBannerProps) {
  if (!jobId) return null

  return (
    <div className="px-6 py-3 bg-primary-50 border-b">
      <div className="flex items-center gap-4">
        <RefreshCw size={18} className="animate-spin text-primary-600" />
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span>{step}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
