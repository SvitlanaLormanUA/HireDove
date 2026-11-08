import { useAuth } from '../auth/useAuth'
import { NotificationWidget } from './NotificationWidget'
import { ThemeToggle } from './ThemeToggle'

export function HeaderTools() {
  const { user } = useAuth()
  return <div className="header-tools">
    <ThemeToggle />
    {user && <NotificationWidget key={user.id} />}
  </div>
}
