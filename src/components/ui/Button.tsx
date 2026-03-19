import type { ComponentPropsWithoutRef, MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';

/**
 * Button
 *
 * Purpose:
 * Shared action component that renders either a native button or a link.
 *
 * Behavior:
 * - Large screens: keeps the same visual style and interaction model
 * - Medium screens: preserves sizing and responsive width behavior
 * - Mobile: stays visible immediately and does not depend on animation state
 *
 * Notes:
 * - This component does not manage motion
 * - External links automatically receive secure target and rel attributes
 */

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
  // Derived values
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
