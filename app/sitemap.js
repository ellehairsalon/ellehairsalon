export default function sitemap() {
  const site = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
  return [
    { url: site, changeFrequency: 'monthly', priority: 1 },
    { url: `${site}/agendar`, changeFrequency: 'weekly', priority: 0.9 },
  ];
}
