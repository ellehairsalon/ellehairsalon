export default function robots() {
  const base = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/pantalla', '/cita'] }], sitemap: `${base}/sitemap.xml` };
}
