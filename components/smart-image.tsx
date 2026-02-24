'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

export function SmartImage({ src, alt, width, height, className, priority }: Props) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed ? '/placeholder.svg' : src;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      loading={priority ? 'eager' : 'lazy'}
      sizes="(max-width: 768px) 100vw, 50vw"
      priority={priority}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
