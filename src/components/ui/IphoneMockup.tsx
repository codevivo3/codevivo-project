'use client';

import Image from 'next/image';

/**
 * IphoneMockup
 *
 * Purpose:
 * Renders a mobile screenshot inside an iPhone-style device frame.
 *
 * Behavior:
 * - Large screens: shows the same framed mobile preview inside larger layouts
 * - Medium screens: keeps the same markup with responsive parent sizing
 * - Mobile: remains visible when rendered and does not depend on external triggers
 *
 * Notes:
 * - This component does not manage animation timing
 * - The screenshot is intentionally clipped only by the phone screen mask
 */

type Props = {
  src: string;
  alt?: string;
};

export default function IphoneMockup({ src, alt = 'iPhone mockup preview' }: Props) {
  // Render
  return (
    <div className='flex items-center justify-center h-full scale-[1.08]'>
      <div className='relative h-[390px] w-[180px] rounded-[37px] bg-zinc-900 border border-white/30 p-[4px] shadow-device'>
        {/* Left Side Buttons */}
        <div className='absolute left-[-4px] top-[80px] w-[3px] h-[22px] bg-zinc-800 rounded-l-sm border border-white/30' />
        <div className='absolute left-[-4px] top-[110px] w-[3px] h-[30px] bg-zinc-800 rounded-l-sm border border-white/30' />
        <div className='absolute left-[-4px] top-[145px] w-[3px] h-[30px] bg-zinc-800 rounded-l-sm border border-white/30' />

        {/* Right Side Button */}
        <div className='absolute right-[-4px] top-[110px] w-[3px] h-[45px] bg-zinc-800 rounded-r-sm border border-white/30' />

        {/* Notch */}
        <div className='absolute top-[11px] left-1/2 -translate-x-1/2 w-[55px] h-[14px] bg-zinc-900 rounded-full z-10' />

        {/* Screen */}
        <div className='relative h-full w-full rounded-[32px] overflow-hidden bg-black border border-white/5'>
          <Image
            src={src}
            alt={alt}
            fill
            className='object-cover'
            sizes='180px'
          />
        </div>
      </div>
    </div>
  );
}
