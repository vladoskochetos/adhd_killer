import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'ADHD Sprint Planner', description: 'GTD + Kanban + OKR planner' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ru"><body>{children}</body></html>; }
