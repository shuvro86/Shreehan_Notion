import type { Metadata } from 'next';
import './globals.css';
import AuthGate from './components/auth-gate';
export const metadata: Metadata = { title: 'Shreehan HQ — Your learning, in focus', description: 'A focused home for your Shreehan learning workspace.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><AuthGate>{children}</AuthGate></body></html>; }
