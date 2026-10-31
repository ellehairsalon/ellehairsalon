export default function sitemap() {
  return [{ url: process.env.SITE_URL || 'https://ellehairsalon.vercel.app', changeFrequency: 'weekly', priority: 1 }];
}
