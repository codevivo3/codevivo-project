import Header from '@/components/Header';
import Hero from '@/components/Hero';
import TechStack from '@/components/TechStack';
import FeaturedProjectsPinned from '@/components/pinned/projects/FeaturedProjects';
import About from '@/components/About';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <main className='text-fg'>
        <Hero />
        <TechStack />
        <FeaturedProjectsPinned />
        <About />
        <ContactForm />
      </main>
    </>
  );
}
