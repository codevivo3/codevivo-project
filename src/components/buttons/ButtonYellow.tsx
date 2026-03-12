import type { MouseEventHandler, ReactNode } from 'react';

type ButtonYellowProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  type?: 'button' | 'submit' | 'reset';
};

const baseClassName =
  'w-full cursor-pointer rounded-md border border-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-honeydew)] transition bg-[var(--brand-gold)] sm:w-auto hover:bg-surface hover:text-fg';

export default function ButtonYellow({
  children,
  href,
  onClick,
  type = 'button',
}: ButtonYellowProps) {
  if (href) {
    return (
      <a href={href} className={baseClassName} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={baseClassName} onClick={onClick}>
      {children}
    </button>
  );
}
