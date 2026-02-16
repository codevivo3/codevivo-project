import Header from '@/components/Header';
import Hero from '@/components/Hero';
import TechStack from '@/components/TechStack';
import RecentProjects from '@/components/RecentProjects';
import About from '@/components/About';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="bg-[color:var(--background)] text-[color:var(--foreground)]">
        <Hero />
        <TechStack />
        <RecentProjects />
        <About />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
