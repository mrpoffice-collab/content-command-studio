import { currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { syncUser } from '@/lib/user';
import { db } from '@/lib/db';

export default async function DashboardPage() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/sign-in');
  }

  // Sync user to our database
  await syncUser();

  // Get user from database
  const user = await db.getUserByClerkId(clerkUser.id);
  if (!user) {
    redirect('/sign-in');
  }

  // Fetch stats
  const strategies = await db.getStrategiesByUserId(user.id);
  const strategiesCount = strategies.length;

  // Fetch posts
  const posts = await db.getPostsByUserId(user.id);
  const postsCount = posts.length;
  const approvedPostsCount = posts.filter((p: any) => p.status === 'approved').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <Link href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-sunset-orange to-orange-600 bg-clip-text text-transparent">
              Content Command Studio
            </Link>
            <nav className="flex gap-8">
              <Link href="/dashboard" className="text-sm font-semibold text-deep-indigo border-b-2 border-sunset-orange pb-1">
                Dashboard
              </Link>
              <Link href="/dashboard/strategies" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Strategies
              </Link>
              <Link href="/dashboard/posts" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Posts
              </Link>
              <Link href="/dashboard/audit" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                AISO Audit
              </Link>
            </nav>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="mb-4 text-5xl font-black bg-gradient-to-r from-deep-indigo via-blue-600 to-deep-indigo bg-clip-text text-transparent">
            Welcome back, {clerkUser.firstName || 'there'}!
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            AI-powered content optimization for ChatGPT, Perplexity, and Google SGE
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <div className="group rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-300/30 transition-all duration-300 hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Strategies</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-deep-indigo to-blue-600 shadow-lg shadow-blue-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-4xl font-black bg-gradient-to-r from-deep-indigo to-blue-600 bg-clip-text text-transparent">{strategiesCount}</p>
          </div>
          <div className="group rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-orange-300/30 transition-all duration-300 hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Posts Generated</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 shadow-lg shadow-orange-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
            <p className="text-4xl font-black bg-gradient-to-r from-sunset-orange to-orange-600 bg-clip-text text-transparent">{postsCount}</p>
          </div>
          <div className="group rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-green-300/30 transition-all duration-300 hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Posts Approved</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-4xl font-black bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">{approvedPostsCount}</p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-slate-900">Quick Actions</h2>
            </div>
            <div className="flex flex-col gap-4">
              <Link
                href="/dashboard/strategies/new"
                className="group relative px-6 py-4 rounded-xl bg-gradient-to-r from-sunset-orange to-orange-600 text-white font-bold shadow-xl shadow-orange-300/50 hover:shadow-orange-400/60 hover:scale-105 transition-all duration-200 overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Strategy
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
              <Link
                href="/dashboard/strategies"
                className="group px-6 py-4 rounded-xl border-2 border-deep-indigo bg-white text-deep-indigo font-bold hover:bg-deep-indigo hover:text-white shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 hover:scale-105 transition-all duration-200 text-center"
              >
                <span className="flex items-center justify-center gap-2">
                  View All Strategies
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/dashboard/posts"
                className="group px-6 py-4 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-bold hover:border-slate-400 hover:bg-slate-50 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 hover:scale-105 transition-all duration-200 text-center"
              >
                <span className="flex items-center justify-center gap-2">
                  View All Posts
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-deep-indigo to-blue-600">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-slate-900">Getting Started</h2>
            </div>
            <ol className="space-y-4">
              <li className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 text-sm font-black text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                  1
                </span>
                <span className="text-slate-700 font-semibold pt-1 group-hover:text-slate-900 transition-colors">Create a content strategy for your first client</span>
              </li>
              <li className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 text-sm font-black text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                  2
                </span>
                <span className="text-slate-700 font-semibold pt-1 group-hover:text-slate-900 transition-colors">Review and customize the generated topics</span>
              </li>
              <li className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 text-sm font-black text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                  3
                </span>
                <span className="text-slate-700 font-semibold pt-1 group-hover:text-slate-900 transition-colors">Generate blog posts from your topics</span>
              </li>
              <li className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 text-sm font-black text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                  4
                </span>
                <span className="text-slate-700 font-semibold pt-1 group-hover:text-slate-900 transition-colors">Review fact-checks and edit content</span>
              </li>
              <li className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-orange to-orange-600 text-sm font-black text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                  5
                </span>
                <span className="text-slate-700 font-semibold pt-1 group-hover:text-slate-900 transition-colors">Export and publish your content</span>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
