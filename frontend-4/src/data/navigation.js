import {
  Bell,
  Bot,
  CalendarDays,
  FileUp,
  FolderOpen,
  History,
  House,
  Pill,
  UserRound,
} from 'lucide-react'

export const primaryNavigation = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: House, end: true },
  { id: 'upload', label: 'Upload Documents', to: '/upload', icon: FileUp },
  { id: 'records', label: 'My Records', to: '/records', icon: FolderOpen },
  { id: 'copilot', label: 'AI Health Copilot', to: '/copilot', icon: Bot },
  { id: 'timeline', label: 'Health Timeline', to: '/timeline', icon: History },
  { id: 'medicines', label: 'Medicines', to: '/medicines', icon: Pill },
  { id: 'appointments', label: 'Appointments', to: '/appointments', icon: CalendarDays },
  { id: 'reminders', label: 'Reminders', to: '/reminders', icon: Bell },
  { id: 'profile', label: 'Profile', to: '/profile', icon: UserRound },
]
