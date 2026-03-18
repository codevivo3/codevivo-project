'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type PreviewType } from '@/components/projects/ProjectThumbnail';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  fullPreview: string;
  previewType?: PreviewType;
};

export default function ProjectPreviewModal({
  open,
  onClose,
  title,
  fullPreview,
  previewType = 'desktop',
}: Props) {
  const isMobilePreview = previewType === 'mobile';

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className='fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-[modalFadeIn_180ms_ease-out]'
      onClick={onClose}
      aria-hidden={false}
    >
      <div
        className='surface-card relative w-full max-w-[1100px] max-h-[90vh] rounded-xl bg-surface p-6 text-fg shadow-2xl animate-[modalScaleIn_220ms_ease-out] flex flex-col'
        onClick={(event) => event.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label={`${title} project preview`}
      >
        <h3 className='text-xl font-semibold'>{title}</h3>

        {isMobilePreview ? (
          <div className='mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40 p-6'>
            <div className='mx-auto h-[640px] w-[320px] overflow-y-auto rounded-[48px] border-[12px] border-black bg-black shadow-2xl'>
              <div className='sticky top-0 z-10 mx-auto mt-2 h-4 w-20 rounded-full bg-black' />
              <div className='relative min-h-full'>
                <Image
                  src={fullPreview}
                  alt={`${title} full preview`}
                  width={500}
                  height={1800}
                  className='h-auto w-full object-top'
                  priority
                />\
              </div>
            </div>
          </div>
        ) : (
          <div className='mt-4 flex-1 overflow-y-auto rounded-lg border border-border bg-black/40'>
            <Image
              src={fullPreview}
              alt={`${title} full preview`}
              width={1600}
              height={3200}
              className='h-auto w-full object-top'
              priority
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
