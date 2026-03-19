/**
 * ProjectThumbnail
 *
 * Purpose:
 * Renders a clickable project preview thumbnail that opens a modal with a larger preview.
 * Supports both desktop (Macbook mockup) and mobile (iPhone mockups) presentations.
 *
 * Behavior:
 * - Desktop: Displays a Macbook mockup with the preview image centered and scaled.
 * - Mobile: Displays three iPhone mockups (left/center/right) using provided images or fallbacks.
 * - Interaction: Click or keyboard (Enter/Space) opens ProjectPreviewModal.
 *
 * Notes:
 * - This component is purely visual and does not manage animations.
 * - It must not clip shadows (uses overflow-visible on container).
 * - Mobile rendering is static-safe (no dependency on external animation triggers).
 */
'use client';

import { useState } from 'react';
import ProjectPreviewModal from '@/components/projects/ProjectPreviewModal';
import IphoneMockup from '@/components/ui/IphoneMockup';
import MacbookMockup from '@/components/ui/MacbookMockup';

// Types

export type PreviewType = 'desktop' | 'mobile';

type Props = {
  title: string;
  previewImage?: string;
  previewImageLeft?: string;
  previewImageCenter?: string;
  previewImageRight?: string;
  fullPreview: string;
  previewType?: PreviewType;
};

// Component

export default function ProjectThumbnail({
  title,
  previewImage,
  previewImageLeft,
  previewImageCenter,
  previewImageRight,
  fullPreview,
  previewType = 'desktop',
}: Props) {
  // State
  const [open, setOpen] = useState(false);

  // Derived values
  const isMobilePreview = previewType === 'mobile';
  const imageSrc = previewImage ?? fullPreview;
  const leftSrc = previewImageLeft ?? imageSrc;
  const centerSrc = previewImageCenter ?? imageSrc;
  const rightSrc = previewImageRight ?? imageSrc;

  // Render
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
        {/* Responsive preview rendering (mobile vs desktop) */}
        {isMobilePreview ? (
          imageSrc ? (
            <div className='relative flex h-full items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]'>
              <div className="flex items-center justify-center h-full w-full">
                <div className="flex items-center justify-center gap-15 scale-[0.6] origin-center h-full">
                  {[leftSrc, centerSrc, rightSrc].map((src, index) => (
                    <IphoneMockup
                      key={index}
                      src={src}
                      alt={`${title} mobile preview ${index}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className='flex h-full w-full items-center justify-center text-xs text-muted'>
              Preview unavailable
            </div>
          )
        ) : (
          <div className='flex h-full w-full items-center justify-center p-4'>
            {imageSrc ? (
              <div className='h-full flex items-center justify-center'>
                <div className='h-full max-h-[85%] flex items-center justify-center [&>*]:h-full [&>*]:w-auto'>
                  <MacbookMockup
                    src={imageSrc}
                    alt={`${title} preview`}
                  />
                </div>
              </div>
            ) : (
              <div className='flex h-full w-full items-center justify-center text-xs text-muted'>
                Preview unavailable
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal preview */}
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
