'use client'

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

export function DemoBanner() {
  if (!isTestMode) return null

  return (
    <div className="bg-red-50 border-b border-red-200 text-red-700 text-center text-sm font-medium py-1">
      TEST ENVIRONMENT — This is not the production system
    </div>
  )
}
