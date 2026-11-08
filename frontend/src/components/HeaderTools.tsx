import { useAuth } from '../auth/useAuth'
import { NotificationWidget } from './NotificationWidget'
import { ThemeToggle } from './ThemeToggle'
import { ChatWidget } from './ChatWidget'

export function HeaderTools() {
  const { user } = useAuth()
  return <div className="header-tools">
    <ThemeToggle />
    {user && <ChatWidget key={`chat-${user.id}`} />}
    {user && <NotificationWidget key={user.id} />}
  </div>
}
