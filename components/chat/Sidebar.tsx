'use client';

import { useState } from 'react';

export interface Conversation {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  conversations, activeId, onSelect, onNewChat, onDelete, onRename, open, onClose,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

  const handleSelect = (id: string) => {
    onSelect(id);
    if (isMobile()) onClose();
  };

  const handleNewChat = () => {
    onNewChat();
    if (isMobile()) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'flex flex-col shrink-0 overflow-hidden bg-surface',
          'transition-all duration-300 ease-in-out',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-40 w-72',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: inline, width collapses to 0
          'md:relative md:inset-auto md:z-auto md:translate-x-0',
          open ? 'md:w-72' : 'md:w-0',
        ].join(' ')}
      >
        <div className="flex flex-col h-full w-72 bg-surface">

          {/* Header */}
          <div className="flex items-center gap-2 h-14 px-4 shrink-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <VideoCameraIcon className="w-4 h-4 text-accent" />
            </div>
            <span className="text-sm font-semibold text-foreground">Video Analytics</span>
          </div>

          {/* New chat */}
          <div className="px-3 pb-2">
            <button
              onClick={handleNewChat}
              className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                activeId === null
                  ? 'bg-bg border-l-2 border-accent text-foreground font-medium pl-[10px]'
                  : 'text-muted hover:text-foreground hover:bg-accent/6'
              }`}
            >
              <PlusIcon className="w-4 h-4 shrink-0" />
              New chat
            </button>
          </div>

          {/* Section label */}
          <p className="px-4 pb-1 text-xs font-medium text-muted/60 uppercase tracking-wider">Chats</p>

          {/* Conversation list */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
            {conversations.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted text-center">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group/item flex items-center rounded-lg text-sm transition-colors
                  ${activeId === conv.id
                    ? 'bg-bg border-l-2 border-accent text-foreground font-medium'
                    : 'text-muted hover:text-foreground hover:bg-accent/6'
                  }`}
              >
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                      }
                    }}
                    onBlur={() => {
                      onRename(conv.id, renameValue.trim() || conv.title);
                      setRenamingId(null);
                    }}
                    className="flex-1 bg-transparent text-foreground text-sm outline-none border-b border-accent py-2 px-3 min-w-0"
                  />
                ) : (
                  <button
                    onClick={() => handleSelect(conv.id)}
                    onDoubleClick={() => { setRenamingId(conv.id); setRenameValue(conv.title); }}
                    className={`flex-1 text-left truncate py-2 ${activeId === conv.id ? 'pl-[10px]' : 'px-3'}`}
                    title="Double-click to rename"
                  >
                    {conv.title}
                  </button>
                )}

                {renamingId !== conv.id && (
                  <div className="flex shrink-0 mr-1 opacity-0 group-hover/item:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className="p-1 rounded text-muted hover:text-foreground"
                      title="Rename"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                      className="p-1 rounded text-muted hover:text-accent"
                      title="Delete"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

function VideoCameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
