import React from 'react';
import { ACTIVITY_TRACKER_REPO_URL } from '../lib/constants'; // Optional

export function SetupRequired() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
          Supabase Setup Required
        </h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            It looks like your Supabase environment variables are missing. To run this app,
            you need to connect it to a Supabase project.
          </p>
          <ol className="list-decimal pl-5 space-y-4">
            <li>
              <strong>Create a Supabase Project:</strong> Go to <a href="https://supabase.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">supabase.com</a> and create a new project.
            </li>
            <li>
              <strong>Run the Database Seeding Script:</strong> Open the SQL Editor in your Supabase project and run the queries found in <code>supabase-setup.sql</code> at the root of this project.
            </li>
            <li>
              <strong>Set the Environment Variables:</strong> Copy your project URL and anon public key and add them to your environment variables:
              <pre className="bg-slate-100 p-3 rounded-md mt-2 font-mono text-sm">
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
              </pre>
              If deploying on Vercel, add these to your Vercel project settings. In AI Studio, set them in the Secrets panel.
            </li>
            <li>
              <strong>Create an Admin User:</strong> Use the Supabase Authentication dashboard to create an email/password user for yourself, which you will use to log into the Dashboard.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
