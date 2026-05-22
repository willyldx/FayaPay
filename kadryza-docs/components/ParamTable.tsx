interface Param {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
}

interface ParamTableProps {
  params: Param[]
}

export function ParamTable({ params }: ParamTableProps) {
  return (
    <div className="mt-4 mb-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
              Paramètre
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
              Type
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
              Requis
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr
              key={param.name}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <td className="px-4 py-3">
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-kadryza-600 dark:bg-gray-800 dark:text-kadryza-400">
                  {param.name}
                </code>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {param.type}
                </span>
              </td>
              <td className="px-4 py-3">
                {param.required ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    requis
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {param.default ? `défaut: ${param.default}` : 'optionnel'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {param.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
