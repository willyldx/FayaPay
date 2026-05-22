interface EndpointHeaderProps {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description?: string
}

const methodStyles: Record<string, { bg: string; text: string }> = {
  GET: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300'
  },
  POST: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300'
  },
  PUT: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300'
  },
  PATCH: {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    text: 'text-orange-700 dark:text-orange-300'
  },
  DELETE: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300'
  }
}

export function EndpointHeader({ method, path, description }: EndpointHeaderProps) {
  const style = methodStyles[method] || methodStyles.GET

  return (
    <div className="mt-6 mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
        >
          {method}
        </span>
        <code className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {path}
        </code>
      </div>
      {description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  )
}
