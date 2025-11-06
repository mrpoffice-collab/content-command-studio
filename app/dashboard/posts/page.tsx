// Force recompile - darker text update v2
import { currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export default async function PostsPage() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/sign-in');
  }

  // Get user from database
  const user = await db.getUserByClerkId(clerkUser.id);
  if (!user) {
    redirect('/sign-in');
  }

  // Fetch all posts for this user
  const posts = await db.getPostsByUserId(user.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <Link href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-sunset-orange to-orange-600 bg-clip-text text-transparent">
              Content Command Studio
            </Link>
            <nav className="flex gap-8">
              <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Dashboard
              </Link>
              <Link href="/dashboard/strategies" className="text-sm font-semibold text-slate-600 hover:text-deep-indigo transition-all duration-200 hover:scale-105">
                Strategies
              </Link>
              <Link href="/dashboard/posts" className="text-sm font-semibold text-deep-indigo border-b-2 border-sunset-orange pb-1">
                Posts
              </Link>
            </nav>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="mb-3 text-5xl font-black bg-gradient-to-r from-deep-indigo via-blue-600 to-deep-indigo bg-clip-text text-transparent">
            Generated Posts
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            Review, edit, and approve your AI-generated blog posts
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-xl shadow-slate-200/50">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset-orange to-orange-600 shadow-xl shadow-orange-200">
              <svg
                className="h-12 w-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-3xl font-bold text-slate-900">No posts yet</h3>
            <p className="mb-8 text-lg text-slate-600 max-w-md mx-auto">
              Generate your first blog post from a topic in your content strategy
            </p>
            <Link
              href="/dashboard/strategies"
              className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-sunset-orange to-orange-600 px-8 py-4 font-bold text-white shadow-xl shadow-orange-300/50 hover:shadow-orange-400/60 hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Go to Strategies
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post: any) => {
              const factChecksArray = Array.isArray(post.fact_checks) ? post.fact_checks : [];
              const factCheckScore = factChecksArray.length > 0
                ? Math.round(factChecksArray.reduce((sum: number, fc: any) => sum + (fc.confidence || 0), 0) / factChecksArray.length)
                : 100;

              // Use AISO score if available, otherwise use fact-check score (legacy)
              const overallScore = post.aiso_score || factCheckScore;
              const hasAisoScore = post.aiso_score > 0;

              return (
                <Link
                  key={post.id}
                  href={`/dashboard/posts/${post.id}`}
                  className="group rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-300 hover:-translate-y-2 hover:border-sunset-orange/50"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      post.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                      post.status === 'draft' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {post.status}
                    </span>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-3 py-1 rounded-lg border ${
                        overallScore >= 90 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
                        overallScore >= 75 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' :
                        'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'
                      }`}>
                        <p className={`text-xs font-bold ${
                          overallScore >= 90 ? 'text-green-700' :
                          overallScore >= 75 ? 'text-deep-indigo' :
                          'text-orange-700'
                        }`}>
                          {hasAisoScore ? 'AISO' : 'Score'}: {overallScore}/100
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="mb-3 text-xl font-black text-slate-900 group-hover:bg-gradient-to-r group-hover:from-sunset-orange group-hover:to-orange-600 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-2">
                    {post.title}
                  </h3>

                  {post.meta_description && (
                    <p className="mb-4 text-sm text-slate-900 font-semibold line-clamp-2">
                      {post.meta_description}
                    </p>
                  )}

                  <div className="mb-5 flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-bold">{post.word_count} words</span>
                    </div>
                    {factChecksArray.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-900">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-bold">{factChecksArray.length} checks</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-sunset-orange group-hover:gap-3 transition-all">
                      View & Edit
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
