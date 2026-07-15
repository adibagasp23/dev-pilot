import { useEffect, useState } from 'react'

interface Toast {
  message: string
  id: number
}

let toastId = 0
let addToastFn: ((msg: string) => void) | null = null

export function toast(msg: string) {
  addToastFn?.(msg)
}

export function Snackbar() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToastFn = (msg: string) => {
      const id = ++toastId
      setToasts((prev) => [...prev, { message: msg, id }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 2000)
    }
    return () => { addToastFn = null }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-gray-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl animate-[fadeInUp_0.2s_ease-out]"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          ✅ {t.message}
        </div>
      ))}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
