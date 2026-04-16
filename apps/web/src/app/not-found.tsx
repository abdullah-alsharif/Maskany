import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="page-content flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h2 className="font-display text-2xl text-stone-950">Page not found</h2>
      <p className="mt-2 text-stone-600">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center h-12 px-6 rounded-xl bg-terracotta-500 text-white font-semibold hover:bg-terracotta-600 transition-colors"
      >
        Back to home
      </Link>
    </section>
  );
}
