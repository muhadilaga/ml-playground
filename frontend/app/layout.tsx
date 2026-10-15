import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ML Playground — Interactive Dataset & Model Training",
  description: "Next.js frontend for FastAPI ML Playground: CSV dataset upload, sample datasets, model training, and tree visualizations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
          ML Playground — Powered by FastAPI backend & Next.js 14 App Router
        </footer>
      </body>
    </html>
  );
}
