import { Hero } from "../components/Hero";
import { PersonalInfo } from "../components/PersonalInfo";
import { BentoGrid } from "../components/BentoGrid";
import { Experience } from "../components/Experience";
import { Projects } from "../components/Projects";

export function Home() {
  return (
    <>
      <Hero />
      <PersonalInfo />
      <BentoGrid />
      <Experience />
      <Projects />
    </>
  );
}
