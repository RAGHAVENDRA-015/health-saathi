import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export function SafeImage({ src, alt = '', className, imgClassName, fallbackIcon: FallbackIcon = ImageOff, ...props }) {
  const [status, setStatus] = useState(src ? 'loading' : 'error')
  const isDecorative = alt === ''

  if (!src && status !== 'error') {
    setStatus('error')
  }

  return (
    <div className={cn('relative', className)}>
      {status !== 'error' && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'transition-opacity duration-500',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
          {...props}
        />
      )}
      {status === 'loading' && (
        <div aria-hidden="true" className="absolute inset-0 animate-pulse rounded-[inherit] bg-ice-200/50" />
      )}
      {status === 'error' && (
        <div
          {...(isDecorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': alt })}
          className="absolute inset-0 grid place-items-center rounded-[inherit] bg-linear-to-br from-ice-100 to-brand-100 text-brand-500"
        >
          <FallbackIcon className="size-8 opacity-70" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
