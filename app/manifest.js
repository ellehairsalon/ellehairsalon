export default function manifest() {
  return {
    name: 'Elle Hair Salon', short_name: 'Elle', start_url: '/admin', display: 'standalone',
    background_color: '#f8f6f9', theme_color: '#8e1b4a',
    icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  };
}
