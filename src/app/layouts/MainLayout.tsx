import { Outlet, ScrollRestoration } from "react-router";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function MainLayout() {
  return (
    <div className="bg-white min-h-screen font-sans selection:bg-[#1d1d1f] selection:text-white pb-0 flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
