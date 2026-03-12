import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';

type ButtonBlueProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  type?: 'button' | 'submit' | 'reset';
};

const baseClassName =
  'w-full cursor-pointer rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-[var(--brand-honeydew)] transition hover:bg-surface hover:text-fg sm:w-auto';

export default function ButtonBlue({
  children,
  href,
  onClick,
  type = 'button',
}: ButtonBlueProps) {
  if (href) {
    return (
      <Link href={href} className={baseClassName} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={baseClassName} onClick={onClick}>
      {children}
    </button>
  );
}
