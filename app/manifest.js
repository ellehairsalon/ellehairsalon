export default function manifest() {
  return {
    name: 'Elle Hair Salon', short_name: 'Elle', start_url: '/admin', display: 'standalone',
    background_color: '#fef9ef', theme_color: '#b05a36',
    icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  };
}
