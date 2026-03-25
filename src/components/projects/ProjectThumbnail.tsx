/**
 * ProjectThumbnail
 *
 * Purpose:
 * Renders the interactive preview surface for a project card.
 *
 * Context:
 * Used by `ProjectCard` to present either desktop or mobile mockups and open the larger modal view.
 *
 * Dependencies:
 * - `ProjectPreviewModal` for enlarged previews
 * - `MacbookMockup` and `IphoneMockup` for framed device rendering
 * - preview assets already resolved by `getProjectAssets`
 *
 * Notes:
 * - Keep fallback image selection here simple; asset path resolution belongs to the helper layer.
 * - The container must stay keyboard-accessible because it behaves like an interactive control.
 */
'use client';

import { useState } from 'react';
import ProjectPreviewModal from '@/components/projects/ProjectPreviewModal';
import IphoneMockup from '@/components/ui/IphoneMockup';
import MacbookMockup from '@/components/ui/MacbookMockup';

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

export default function ProjectThumbnail({
  title,
  previewImage,
  previewImageLeft,
  previewImageCenter,
  previewImageRight,
  fullPreview,
  previewType = 'desktop',
}: Props) {
  const [open, setOpen] = useState(false);

  const isMobilePreview = previewType === 'mobile';
  // Fall back to the resolved primary preview so partial mobile asset sets still render.
  const imageSrc = previewImage ?? fullPreview;
  const leftSrc = previewImageLeft ?? imageSrc;
  const centerSrc = previewImageCenter ?? imageSrc;
  const rightSrc = previewImageRight ?? imageSrc;

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
        {/* Render the correct device framing without re-resolving asset paths here. */}
        {isMobilePreview ? (
          imageSrc ? (
            <div className='relative flex h-full items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]'>
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex h-full origin-center items-center justify-center gap-15 scale-[0.52] sm:scale-[0.6]">
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
              <div className='flex h-full w-full items-center justify-center'>
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
