import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const variants = {
  primary:
    'bg-accent-400 text-navy-950 hover:bg-accent-500 shadow-[0_10px_24px_-12px_rgb(111_174_51/0.9)]',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 shadow-[0_10px_24px_-12px_rgb(10_42_94/0.8)]',
  secondary: 'border border-ice-200 bg-white text-navy-900 hover:bg-ice-50',
  ghost: 'text-brand-600 hover:bg-brand-100/70',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

export function Button({ to, variant = 'primary', size = 'md', className, children, ...props }) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
    variants[variant],
    sizes[size],
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
