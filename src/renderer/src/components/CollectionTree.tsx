import type { MouseEvent as ReactMouseEvent } from 'react'
import type { ApiRequest, Collection } from '../types/api'
import { METHOD_STYLES, statusTone } from '../lib/methods'
import { Bookmark, ChevronDown, ChevronRight, Folder, Layers, Plus } from './Icons'
import InlineEdit from './InlineEdit'

interface RenameTarget {
  type: 'collection' | 'request'
  id: string
}

interface CollectionTreeProps {
  collections: Collection[]
  expanded: Record<string, boolean>
  onToggle: (key: string) => void
  selectedCollectionId: string | null
  selectedRequestId: string | null
  selectedExampleId: string | null
  onSelectCollection: (collectionId: string) => void
  onSelectRequest: (requestId: string) => void
  onSelectExample: (exampleId: string, requestId: string) => void
  search: string
  renaming: RenameTarget | null
  onCollectionContextMenu: (collectionId: string, event: ReactMouseEvent) => void
  onRequestContextMenu: (requestId: string, event: ReactMouseEvent) => void
  onExampleContextMenu: (exampleId: string, requestId: string, event: ReactMouseEvent) => void
  onRenameCollection: (collectionId: string, name: string) => void
  onRenameRequest: (requestId: string, name: string) => void
  onCancelRename: () => void
  onNewRequest: (collectionId: string) => void
}

interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  requests: ApiRequest[]
}

const buildTree = (requests: ApiRequest[]): TreeNode => {
  const root: TreeNode = { name: '', path: '', children: [], requests: [] }
  const nodes = new Map<string, TreeNode>()

  for (const request of requests) {
    const group = request.group ?? []
    let parent = root
    let path = ''
    for (const segment of group) {
      path = path ? `${path}/${segment}` : segment
      let node = nodes.get(path)
      if (!node) {
        node = { name: segment, path, children: [], requests: [] }
        nodes.set(path, node)
        parent.children.push(node)
      }
      parent = node
    }
    parent.requests.push(request)
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.children.forEach(sortNode)
  }
  sortNode(root)
  return root
}

const countRequests = (node: TreeNode): number =>
  node.requests.length + node.children.reduce((sum, child) => sum + countRequests(child), 0)

export default function CollectionTree({
  collections,
  expanded,
  onToggle,
  selectedCollectionId,
  selectedRequestId,
  selectedExampleId,
  onSelectCollection,
  onSelectRequest,
  onSelectExample,
  search,
  renaming,
  onCollectionContextMenu,
  onRequestContextMenu,
  onExampleContextMenu,
  onRenameCollection,
  onRenameRequest,
  onCancelRename,
  onNewRequest
}: CollectionTreeProps) {
  const query = search.trim().toLowerCase()

  const filtered = collections
    .map((collection) => {
      if (!query) return collection
      const collectionMatches = collection.name.toLowerCase().includes(query)
      const requests = collection.requests.filter(
        (request) =>
          request.name.toLowerCase().includes(query) ||
          request.url.toLowerCase().includes(query) ||
          request.method.toLowerCase().includes(query) ||
          (request.group ?? []).some((segment) => segment.toLowerCase().includes(query)) ||
          (request.examples ?? []).some((example) => example.name.toLowerCase().includes(query))
      )
      return collectionMatches ? collection : { ...collection, requests }
    })
    .filter(
      (collection) =>
        !query || collection.name.toLowerCase().includes(query) || collection.requests.length > 0
    )

  const renderRequest = (request: ApiRequest) => {
    const examples = request.examples ?? []
    const exampleKey = `ex:${request.id}`
    const examplesOpen = query ? true : Boolean(expanded[exampleKey])
    const active = request.id === selectedRequestId && !selectedExampleId
    const method = METHOD_STYLES[request.method]
    const isRenamingRequest = renaming?.type === 'request' && renaming.id === request.id

    return (
      <div key={request.id} className="flex flex-col gap-0.5">
        <div
          onContextMenu={(event) => onRequestContextMenu(request.id, event)}
          className={`group flex w-full items-center gap-0.5 rounded-md transition-colors ${
            active
              ? 'bg-studio-accent/15 text-studio-text ring-1 ring-inset ring-studio-accent/30'
              : 'text-studio-muted hover:bg-studio-strong/40 hover:text-studio-text'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectRequest(request.id)}
            title={`${request.method} ${request.url}`}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
          >
            <span className={`w-9 shrink-0 font-mono text-[10px] font-bold ${method.text}`}>{request.method}</span>

            {isRenamingRequest ? (
              <InlineEdit
                value={request.name}
                onCommit={(name) => onRenameRequest(request.id, name)}
                onCancel={onCancelRename}
              />
            ) : (
              <span className="truncate">{request.name}</span>
            )}

            {!isRenamingRequest && request.mock && (
              <span
                className="ml-auto h-1 w-1 shrink-0 rounded-full bg-violet-400/70"
                title="Mock response enabled"
              />
            )}
          </button>

          {examples.length > 0 && (
            <button
              type="button"
              onClick={() => onToggle(exampleKey)}
              title={examplesOpen ? 'Hide examples' : 'Show examples'}
              className="mr-1 flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-2xs text-studio-faint transition-colors hover:bg-studio-strong/60 hover:text-studio-text"
            >
              <Bookmark className="h-3 w-3" />
              {examples.length}
              {examplesOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {examplesOpen && examples.length > 0 && (
          <div className="ml-[22px] flex flex-col gap-0.5 border-l border-studio-border pl-2">
            {examples.map((example) => {
              const exampleActive = example.id === selectedExampleId
              return (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => onSelectExample(example.id, request.id)}
                  onContextMenu={(event) => onExampleContextMenu(example.id, request.id, event)}
                  title={`${example.status} ${example.statusText} — ${example.name}`}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    exampleActive
                      ? 'bg-sky-500/15 text-studio-text ring-1 ring-inset ring-sky-500/30'
                      : 'text-studio-muted hover:bg-studio-strong/40 hover:text-studio-text'
                  }`}
                >
                  <Bookmark className="h-3 w-3 shrink-0 text-sky-400/80" />
                  <span className={`w-8 shrink-0 font-mono text-[10px] font-bold ${statusTone(example.status)}`}>
                    {example.status}
                  </span>
                  <span className="truncate">{example.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderNode = (node: TreeNode, collectionId: string) => {
    const key = `${collectionId}::${node.path}`
    const open = query ? true : Boolean(expanded[key])

    return (
      <div key={key} className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onToggle(key)}
          title={`${open ? 'Collapse' : 'Expand'} folder`}
          className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-studio-muted transition-colors hover:bg-studio-strong/40 hover:text-studio-text"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-studio-faint" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-studio-faint" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-studio-faint" />
          <span className="truncate">{node.name}</span>
          <span className="ml-auto rounded-full bg-studio-strong/60 px-1.5 text-2xs text-studio-faint">
            {countRequests(node)}
          </span>
        </button>

        {open && (
          <div className="relative ml-[18px] flex flex-col gap-0.5 border-l border-studio-border pl-2">
            {node.children.map((child) => renderNode(child, collectionId))}
            {node.requests.map(renderRequest)}
          </div>
        )}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-studio-faint">
        {query ? `No collections match “${search}”.` : 'No collections yet.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      {filtered.map((collection) => {
        const isOpen = query ? true : Boolean(expanded[collection.id])
        const collectionActive = collection.id === selectedCollectionId && !selectedRequestId
        const isRenamingCollection = renaming?.type === 'collection' && renaming.id === collection.id
        const tree = buildTree(collection.requests)

        return (
          <div key={collection.id}>
            <button
              type="button"
              onClick={() => {
                onSelectCollection(collection.id)
                onToggle(collection.id)
              }}
              onContextMenu={(event) => onCollectionContextMenu(collection.id, event)}
              title={`${isOpen ? 'Collapse' : 'Expand'} collection`}
              className={`group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors ${
                collectionActive ? 'bg-studio-strong/50 text-studio-text' : 'text-studio-text hover:bg-studio-strong/40'
              }`}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-studio-faint" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-studio-faint" />
              )}
              <Layers className="h-3.5 w-3.5 shrink-0 text-studio-muted" />

              {isRenamingCollection ? (
                <InlineEdit
                  value={collection.name}
                  onCommit={(name) => onRenameCollection(collection.id, name)}
                  onCancel={onCancelRename}
                />
              ) : (
                <>
                  <span className="truncate font-medium">{collection.name}</span>
                  <span className="ml-auto rounded-full bg-studio-strong/60 px-1.5 text-2xs text-studio-faint">
                    {collection.requests.length}
                  </span>
                </>
              )}
            </button>

            {isOpen && (
              <div className="relative ml-[18px] mt-0.5 flex flex-col gap-0.5 border-l border-studio-border pl-2">
                {collection.requests.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onNewRequest(collection.id)}
                    title="Add the first request to this collection"
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-studio-faint transition-colors hover:bg-studio-strong/40 hover:text-studio-text"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    No requests — add one
                  </button>
                )}

                {tree.children.map((child) => renderNode(child, collection.id))}
                {tree.requests.map(renderRequest)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
