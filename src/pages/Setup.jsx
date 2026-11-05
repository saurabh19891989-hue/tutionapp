import { Logo } from '../components/Layout'

// Shown only when public/config.js still has placeholder values
export default function Setup() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-lg p-6">
        <Logo />
        <h1 className="mt-5 text-xl font-extrabold">Almost ready — connect the database</h1>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Create a free project at <a className="font-bold text-brand-600" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com</a>.</li>
          <li>Open <b>SQL Editor</b>, paste the contents of <code>supabase/schema.sql</code> and click <b>Run</b>.</li>
          <li>Copy the <b>Project URL</b> and <b>anon / publishable key</b> from Project Settings → API into <code>public/config.js</code> (or the GitHub repository variables <code>SUPABASE_URL</code> / <code>SUPABASE_ANON_KEY</code>).</li>
          <li>Reload this page.</li>
        </ol>
        <p className="mt-4 text-xs text-muted">Full steps are in the README.</p>
      </div>
    </div>
  )
}
