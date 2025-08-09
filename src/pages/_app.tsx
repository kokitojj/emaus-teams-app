// src/pages/_app.tsx

import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import Nav from '../components/Nav'; // Importamos el nuevo componente

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Nav />
      <Component {...pageProps} />
    </SessionProvider>
  );
}

export default MyApp;