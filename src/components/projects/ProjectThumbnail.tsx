'use client';

import { useState } from 'react';
import Image from 'next/image';
import ProjectPreviewModal from '@/components/projects/ProjectPreviewModal';

export type PreviewType = 'desktop' | 'mobile';

type Props = {
  title: string;
  previewImage?: string;
  previewImageLeft?: string;
  previewImageCenter?: string;
  previewImageRight?: string;
  previewUrl?: string;
  fullPreview: string;
  previewType?: PreviewType;
};

export default function ProjectThumbnail({
  title,
  previewImage,
  previewImageLeft,
  previewImageCenter,
  previewImageRight,
  previewUrl,
  fullPreview,
  previewType = 'desktop',
}: Props) {
  const [open, setOpen] = useState(false);
  const isMobilePreview = previewType === 'mobile';
  const imageSrc = previewImage ?? fullPreview;
  const leftSrc = previewImageLeft ?? imageSrc;
  const centerSrc = previewImageCenter ?? imageSrc;
  const rightSrc = previewImageRight ?? imageSrc;
  const phoneClassName =
    'relative flex items-start justify-center rounded-3xl bg-neutral-900 shadow-xl';

  return (
    <>
      <div
        className='group relative aspect-[16/9] cursor-pointer overflow-visible rounded-md'
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        role='button'
        tabIndex={0}
        aria-label={`Open ${title} preview`}
      >
        {isMobilePreview ? (
          imageSrc ? (
            <div className='relative flex h-full items-center justify-center pt-6 pb-6 transition-transform duration-300 group-hover:scale-[1.03]'>
              <div
                className={`${phoneClassName} absolute left-[12%] h-[243px] w-[140px] p-[6px] opacity-85 scale-[0.97]`}
              >
                <div className='absolute top-[10px] left-1/2 -translate-x-1/2 h-[12px] w-[44px] rounded-full bg-black z-20' />
                <div className='relative h-full w-full overflow-hidden rounded-2xl bg-black'>
                  <Image
                    key={leftSrc}
                    src={leftSrc}
                    alt={`${title} mobile preview left`}
                    fill
                    sizes='200px'
                    className='object-cover object-top'
                    loading='lazy'
                    unoptimized
                  />
                </div>
              </div>
              <div
                className={`${phoneClassName} relative z-10 h-[270px] w-[135px] p-[6px]`}
              >
                <div className='absolute top-[10px] left-1/2 -translate-x-1/2 h-[13px] w-[54px] rounded-full bg-black z-20' />
                <div className='relative h-full w-full overflow-hidden rounded-2xl bg-black'>
                  <Image
                    key={centerSrc}
                    src={centerSrc}
                    alt={`${title} mobile preview`}
                    fill
                    sizes='200px'
                    className='object-cover object-top'
                    loading='lazy'
                    unoptimized
                  />
                </div>
              </div>
              <div
                className={`${phoneClassName} absolute right-[12%] h-[243px] w-[140px] p-[6px] opacity-85 scale-[0.97]`}
              >
                <div className='absolute top-[10px] left-1/2 -translate-x-1/2 h-[12px] w-[44px] rounded-full bg-black z-20' />
                <div className='relative h-full w-full overflow-hidden rounded-2xl bg-black'>
                  <Image
                    key={rightSrc}
                    src={rightSrc}
                    alt={`${title} mobile preview right`}
                    fill
                    sizes='200px'
                    className='object-cover object-top'
                    loading='lazy'
                    unoptimized
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className='flex h-full w-full items-center justify-center text-xs text-muted'>
              Preview unavailable
            </div>
          )
        ) : (
          <div className='absolute inset-x-[1.5%] bottom-[2%] top-[1.5%] rounded-t-[1rem] border border-border bg-surface p-[2.5%] transition-transform duration-300 group-hover:scale-[1.03]'>
            <div className='absolute left-1/2 top-[1.25%] h-1 w-12 -translate-x-1/2 rounded-full bg-border/80' />
            <div className='relative h-full overflow-hidden rounded-[0.6rem] border border-border bg-black/10'>
              {previewUrl ||
              (typeof fullPreview === 'string' &&
                fullPreview.startsWith('http')) ? (
                <iframe
                  src={previewUrl ?? fullPreview}
                  title={`${title} preview`}
                  className='absolute inset-0 h-full w-full border-0'
                  loading='lazy'
                />
              ) : imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={`${title} preview`}
                  fill
                  sizes='(max-width: 768px) 100vw, 768px'
                  className='object-cover object-top'
                  loading='lazy'
                />
              ) : (
                <div className='flex h-full w-full items-center justify-center text-xs text-muted'>
                  Preview unavailable
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ProjectPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        fullPreview={fullPreview}
        previewType={previewType}
      />
    </>
  );
}
