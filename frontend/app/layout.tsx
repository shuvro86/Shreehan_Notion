import type { Metadata } from 'next';
import './globals.css';
import AuthGate from './_components/auth-gate';
import SavePopup from './_components/save-popup';
export const metadata: Metadata = { title: 'Shreehan HQ — Your learning, in focus', description: 'A focused home for your Shreehan learning workspace.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><AuthGate>{children}</AuthGate><SavePopup/></body></html>; }
