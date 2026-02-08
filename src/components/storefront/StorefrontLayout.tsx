import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface StorefrontLayoutProps {
  children: ReactNode;
}

export function StorefrontLayout({ children }: StorefrontLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
