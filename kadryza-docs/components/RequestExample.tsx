import { Tabs } from 'nextra/components'

interface RequestExampleProps {
  curl: string
  sdk: string
  http?: string
}

export function RequestExample({ curl, sdk, http }: RequestExampleProps) {
  const items = ['cURL', 'Node.js SDK']
  const contents = [curl, sdk]

  if (http) {
    items.push('HTTP')
    contents.push(http)
  }

  return (
    <div className="mt-4 mb-6">
      <Tabs items={items}>
        {contents.map((content, index) => (
          <Tabs.Tab key={index}>
            <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900">
              <code>{content}</code>
            </pre>
          </Tabs.Tab>
        ))}
      </Tabs>
    </div>
  )
}
