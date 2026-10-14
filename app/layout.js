import "./globals.css";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import ChatWidget from "../components/ChatWidget";
import RegisterSW from "../components/RegisterSW";
import { PresenceProvider } from "../lib/presence";

export const metadata = {
  title: "Plinth — Architecture Project Marketplace",
  description: "Find the right person for your architecture project.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
    <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <meta name="theme-color" content="#16150f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Plinth" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <PresenceProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
        <ChatWidget />
          <RegisterSW />
        </PresenceProvider>
      </body>
    </html>
  );
}
