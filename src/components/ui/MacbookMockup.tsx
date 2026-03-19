'use client';

import Image from 'next/image';

/**
 * MacbookMockup
 *
 * Purpose:
 * Renders a desktop screenshot inside a MacBook-style device frame.
 *
 * Behavior:
 * - Large screens: shows the full mockup at its intended desktop size
 * - Medium screens: scales within its parent container
 * - Mobile: remains visible immediately when rendered and does not depend on parent motion state
 *
 * Notes:
 * - This component does not manage animation timing
 * - The screenshot is clipped only within the mockup screen, not by outer layout wrappers
 */

type Props = {
  src: string;
  alt?: string;
};

export default function MacbookMockup({
  src,
  alt = 'MacBook mockup preview',
}: Props) {
  // Render
  return (
    <div className='flex items-center justify-center'>
      <div className='flex flex-col items-center'>
        <div className='shadow-device relative h-[228px] w-[364px] rounded-[10px] border border-white/10 bg-zinc-900 p-[6px]'>
          <div className='absolute top-[4px] left-1/2 z-10 h-[3px] w-[42px] -translate-x-1/2 rounded-full bg-zinc-800' />

          <div className='relative h-full w-full overflow-hidden rounded-[7px] border border-white/5 bg-black'>
            <Image
              src={src}
              alt={alt}
              fill
              className='object-cover object-top'
              sizes='(max-width: 768px) 100vw, 520px'
            />
          </div>
        </div>

        <div className='relative mt-[2px] h-[13px] w-[392px] rounded-b-[10px] border border-white/10 bg-zinc-800'>
          <div className='absolute top-[3px] left-1/2 h-[4px] w-[84px] -translate-x-1/2 rounded-full bg-zinc-700 opacity-60' />
        </div>
      </div>
    </div>
  );
}
