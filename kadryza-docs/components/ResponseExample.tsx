interface ResponseExampleProps {
  status: number
  body: Record<string, unknown>
}

export function ResponseExample({ status, body }: ResponseExampleProps) {
  const statusColor =
    status >= 200 && status < 300
      ? 'text-emerald-600 dark:text-emerald-400'
      : status >= 400
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400'

  return (
    <div className="mt-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Réponse
        </span>
        <span className={`text-xs font-bold ${statusColor}`}>
          {status}
        </span>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <code className="language-json">
          {JSON.stringify(body, null, 2)}
        </code>
      </pre>
    </div>
  )
}
