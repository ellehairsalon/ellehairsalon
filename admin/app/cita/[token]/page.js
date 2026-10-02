import Manage from './Manage';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const { token } = await params;
  return (
    <main>
      <h1>Elle Hair Salon</h1>
      <Manage token={token} />
    </main>
  );
}
