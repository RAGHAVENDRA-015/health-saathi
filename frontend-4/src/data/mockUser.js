export const mockUser = {
  id: 'user-lakshmi',
  firstName: 'Lakshmi',
  displayName: 'Lakshmi K.',
  email: 'lakshmi.k@example.com',
  avatar: '/images/avatar.png',
  bloodGroup: 'B+',
  age: 29,
  city: 'Hyderabad',
}

export const mockNotifications = [
  {
    id: 'ntf-report-analyzed',
    title: 'Blood Test Report analyzed',
    description: 'Your sample insights are ready to review.',
    to: '/reports',
    time: '2h ago',
  },
  {
    id: 'ntf-vitamin-d',
    title: 'Vitamin D below range',
    description: 'Demo insight from your latest blood test.',
    to: '/reports',
    time: 'Yesterday',
  },
  {
    id: 'ntf-appointment',
    title: 'Follow-up with Dr. Mehta',
    description: 'Review your appointment organizer and sample follow-up.',
    to: '/appointments',
    time: '3 days ago',
  },
]
