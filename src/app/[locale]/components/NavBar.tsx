'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function NavBar() {
  return (
    <header className='w-full px-4 py-3 shadow-sm bg-white dark:bg-zinc-900 font-mono'>
      <div className='max-w-7xl mx-auto flex items-center justify-between'>
        <Link
          href='/'
          className='text-xl font-bold text-zinc-900 dark:text-white'
        >
          <Image
            src='/logos/codevivo_logo_text_color.svg'
            alt='Logo'
            width={180}
            height={180}
          />
        </Link>

        {/* Navigation */}
        <nav className='flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-300'>
          <Link
            href='#about'
            className='hover:text-black dark:hover:text-white transition'
          >
            About
          </Link>
          <Link
            href='#projects'
            className='hover:text-black dark:hover:text-white transition'
          >
            Projects
          </Link>
          <Link
            href='#tools'
            className='hover:text-black dark:hover:text-white transition'
          >
            Tools
          </Link>
          <Link
            href='#contact'
            className='hover:text-black dark:hover:text-white transition'
          >
            Contact
          </Link>
          <span className='text-zinc-300 dark:text-zinc-600'>|</span>
          <button
            aria-label='Toggle Theme'
            className='w-5 h-5 rounded-full bg-zinc-400 dark:bg-zinc-500'
          />
        </nav>
      </div>
    </header>
  );
}
