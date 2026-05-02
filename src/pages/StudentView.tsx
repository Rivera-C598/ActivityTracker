import React, { useState, useEffect } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Student, Submission, ACTIVITIES, STATUS_LABELS, REMARK_LABELS } from '../types';
import { StatusIcon } from '../components/StatusIcon';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export function StudentView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('students')
        .select('*')
        .or(`lastname.ilike.%${searchTerm}%,firstname.ilike.%${searchTerm}%`)
        .order('lastname')
        .limit(10);
      
      setSearchResults((data as Student[]) || []);
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!selectedStudent) {
      setSubmissions({});
      return;
    }

    const fetchSubmissions = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', selectedStudent.id);
      
      if (data) {
        const subMap: Record<string, Submission> = {};
        for (const sub of (data as Submission[])) {
          subMap[sub.activity_key] = sub;
        }
        setSubmissions(subMap);
      }
    };

    fetchSubmissions();
  }, [selectedStudent]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Activity Tracker
        </h1>
        <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Teacher Login
        </Link>
      </div>

      <div className="w-full max-w-3xl bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <label htmlFor="search" className="block text-sm font-medium text-slate-700 mb-2">
            Find your record
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              id="search"
              placeholder="Search by last or first name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedStudent(null); // Clear selected when searching
              }}
              className="pl-10 block w-full rounded-md border border-slate-300 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {!selectedStudent && searchResults.length > 0 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-md shadow-sm divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {searchResults.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 focus:outline-none flex items-center justify-between transition-colors"
                >
                  <span className="font-medium text-slate-900">{student.lastname}, {student.firstname}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
          {!selectedStudent && searchTerm.length >= 2 && !loading && searchResults.length === 0 && (
             <div className="mt-4 text-sm text-slate-500 p-4 text-center">No students found matching "{searchTerm}"</div>
          )}
        </div>

        {selectedStudent && (
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {selectedStudent.firstname} {selectedStudent.lastname}
              </h2>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Clear
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ACTIVITIES.map(actKey => {
                const sub = submissions[actKey];
                const status = sub?.status || 'pending';
                const remarks = sub?.remarks || [];

                return (
                  <div key={actKey} className="border border-slate-200 rounded-lg p-4 flex flex-col bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-700 uppercase tracking-wider text-xs">
                        {actKey}
                      </span>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
                        <StatusIcon status={status} className="h-4 w-4" />
                        <span className="text-sm font-medium text-slate-700">{STATUS_LABELS[status]}</span>
                      </div>
                    </div>

                    {remarks.length > 0 ? (
                      <div className="mt-auto pt-3 border-t border-slate-100 space-y-1">
                        {remarks.map(r => (
                          <div key={r} className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded text-center font-medium">
                            {REMARK_LABELS[r as keyof typeof REMARK_LABELS] || r}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-auto pt-3 border-t border-slate-100 text-xs text-slate-400 text-center italic">
                        No remarks
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
