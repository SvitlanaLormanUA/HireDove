import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APPLICATION_STATUS_LABELS,
  fetchChatMessages,
  fetchChatThreads,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from '../api/applications'
import { useAuth } from '../auth/useAuth'

export function openChatWithApplication(applicationId: number) {
  window.dispatchEvent(new CustomEvent('hiredove:open-chat', { detail: { applicationId } }))
}

export function ChatWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeAppId, setActiveAppId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const canUseChat = user?.role === 'candidate' || user?.role === 'employer'

  const loadThreads = useCallback(() => {
    if (!canUseChat) return
    fetchChatThreads()
      .then((data) => {
        setThreads(data)
        setActiveAppId((prev) => prev ?? (data[0]?.application_id || null))
      })
      .catch(() => {})
  }, [canUseChat])

  const loadMessages = useCallback((appId: number) => {
    fetchChatMessages(appId)
      .then((msgs) => {
        setMessages(msgs)
        setThreads((prev) =>
          prev.map((t) => (t.application_id === appId ? { ...t, unread_count: 0 } : t))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadThreads()
    const interval = setInterval(loadThreads, 5000)
    return () => clearInterval(interval)
  }, [loadThreads])

  // NFR 1.1: Poll messages every 3 seconds when chat is open so messages arrive within <= 5s
  useEffect(() => {
    if (!open || !activeAppId) return
    loadMessages(activeAppId)
    const interval = setInterval(() => loadMessages(activeAppId), 3000)
    return () => clearInterval(interval)
  }, [open, activeAppId, loadMessages])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ applicationId: number }>
      if (custom.detail?.applicationId) {
        setOpen(true)
        setActiveAppId(custom.detail.applicationId)
        loadThreads()
      }
    }
    window.addEventListener('hiredove:open-chat', handler)
    return () => window.removeEventListener('hiredove:open-chat', handler)
  }, [loadThreads])

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, open])

  if (!canUseChat) return null

  const totalUnread = threads.reduce((acc, t) => acc + t.unread_count, 0)
  const activeThread = threads.find((t) => t.application_id === activeAppId) || null

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAppId || !input.trim() || sending) return
    setSending(true)
    try {
      const msg = await sendChatMessage(activeAppId, input.trim())
      setMessages((prev) => [...prev, msg])
      setInput('')
      loadThreads()
    } catch {
      alert('Не вдалося надіслати повідомлення.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn-sm"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) loadThreads()
        }}
        title="Внутрішній чат"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
      >
        💬 Чат
        {totalUnread > 0 && (
          <span
            style={{
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              borderRadius: '999px',
              padding: '0 6px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="modal-backdrop"
          onClick={() => setOpen(false)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(850px, 95vw)',
              maxWidth: '850px',
              height: 'min(560px, 85vh)',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong>💬 Внутрішній чат HireDove</strong>
              <button type="button" className="btn-sm" onClick={() => setOpen(false)}>
                ✕ Закрити
              </button>
            </div>

            {threads.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                У вас ще немає активних діалогів. Діалог з’являється автоматично після відгуку на вакансію.
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Left sidebar: Threads */}
                <div
                  style={{
                    width: '38%',
                    borderRight: '1px solid var(--border, #e5e7eb)',
                    overflowY: 'auto',
                  }}
                >
                  {threads.map((t) => {
                    const isSelected = t.application_id === activeAppId
                    return (
                      <div
                        key={t.application_id}
                        onClick={() => setActiveAppId(t.application_id)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border, #e5e7eb)',
                          background: isSelected ? 'var(--surface-2, rgba(37,99,235,0.08))' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.9rem' }}>
                          <span>{t.partner_name}</span>
                          {t.unread_count > 0 && (
                            <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                              +{t.unread_count}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                          {t.vacancy_title} ({t.company_name})
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>
                          Статус: {APPLICATION_STATUS_LABELS[t.status]}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right panel: Messages */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {activeThread && (
                    <div
                      style={{
                        padding: '0.6rem 1rem',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                        fontSize: '0.85rem',
                        background: 'var(--surface-2, #f9fafb)',
                      }}
                    >
                      Співрозмовник: <strong>{activeThread.partner_name}</strong> · Вакансія:{' '}
                      <strong>{activeThread.vacancy_title}</strong>
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      padding: '1rem',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    {messages.length === 0 ? (
                      <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                        Повідомлень ще немає. Напишіть перше повідомлення!
                      </p>
                    ) : (
                      messages.map((m) => {
                        const isMine = m.sender_id === user?.id
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isMine ? 'flex-end' : 'flex-start',
                              maxWidth: '75%',
                              padding: '0.55rem 0.85rem',
                              borderRadius: '12px',
                              background: isMine ? 'var(--primary, #2563eb)' : 'var(--surface-2, #e5e7eb)',
                              color: isMine ? '#fff' : 'inherit',
                              fontSize: '0.9rem',
                            }}
                          >
                            <div style={{ fontSize: '0.72rem', opacity: 0.8, marginBottom: 2 }}>
                              {isMine ? 'Ви' : m.sender_name}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form
                    onSubmit={handleSend}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      borderTop: '1px solid var(--border, #e5e7eb)',
                    }}
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Введіть повідомлення..."
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button type="submit" className="btn-sm btn-primary" disabled={sending || !input.trim()}>
                      Надіслати
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}