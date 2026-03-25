/**
 * Button
 *
 * Purpose:
 * Provides a single action component that can render as either a link or a native button.
 *
 * Context:
 * Shared across homepage sections, project cards, and utility actions.
 *
 * Dependencies:
 * - Next.js `Link` for internal navigation
 * - shared design tokens for button variants
 *
 * Notes:
 * - External URLs are detected here so callers do not repeat target/rel handling.
 * - Keep variant styling centralized to preserve consistency across the site.
 */
import type { ComponentPropsWithoutRef, MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'accent';

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type LinkButtonProps = SharedProps & {
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
} & Omit<ComponentPropsWithoutRef<'a'>, 'children' | 'className' | 'href' | 'onClick'>;

type NativeButtonProps = SharedProps & {
  href?: undefined;
  onClick?: MouseEventHandler<HTMLButtonElement>;
} & Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'className' | 'href' | 'onClick'>;

type ButtonProps = LinkButtonProps | NativeButtonProps;

const baseClassName =
  'inline-flex w-full cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:bg-surface hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto';

const variantClassNames: Record<ButtonVariant, string> = {
  primary: 'border-primary bg-primary text-[var(--brand-honeydew)]',
  accent:
    'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[var(--brand-honeydew)]',
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function isExternalHref(href: string) {
  return /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(href) || /^[a-z][a-z\d+\-.]*:/i.test(href);
}

export default function Button(props: ButtonProps) {
  const {
    children,
    className,
    variant = 'primary'
  } = props;

  const resolvedClassName = joinClassNames(
    baseClassName,
    variantClassNames[variant],
    className,
  );

  // Render
  if ('href' in props && props.href) {
    const { href, onClick, ...rest } = props as LinkButtonProps;

    // Apply safe external-link attributes centrally instead of duplicating them at call sites.
    if (isExternalHref(href)) {
      return (
        <a
          href={href}
          className={resolvedClassName}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          {...rest}
        >
          {children}
        </a>
      );
    }

    return (
      <Link
        href={href}
        className={resolvedClassName}
        onClick={onClick}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  const { onClick, type = 'button', ...rest } = props as NativeButtonProps;

  return (
    <button
      type={type}
      className={resolvedClassName}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
