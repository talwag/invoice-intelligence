import Hero from "./_components/landing/Hero";
import Benefits from "./_components/landing/Benefits";
import HowItWorks from "./_components/landing/HowItWorks";
import SampleExtraction from "./_components/landing/SampleExtraction";
import Footer from "./_components/landing/Footer";

export default function Home() {
  return (
    <>
      <main className="min-h-full flex-1 bg-white dark:bg-black">
        <Hero />
        <Benefits />
        <HowItWorks />
        <SampleExtraction />
      </main>
      <Footer />
    </>
  );
}
