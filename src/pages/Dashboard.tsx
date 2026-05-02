import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Student, Submission, ACTIVITIES, SubmissionStatus, Remark, STATUS_LABELS, REMARK_LABELS, ActivityKey } from '../types';
import { StatusIcon } from '../components/StatusIcon';
import { LogOut, Users, Download, AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as Papa from 'papaparse';

type StudentWithSubmissions = Student & {
  submissions: Record<ActivityKey, Submission>;
  hasProgressionWarning: boolean;
};

const NEXT_STATUS: Record<SubmissionStatus, SubmissionStatus> = {
  pending: 'pass',
  pass: 'resubmit',
  resubmit: 'oral',
  oral: 'missing',
  missing: 'pending'
};

export function Dashboard() {
  const { signOut } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  
  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    studentId: string;
    activityKey: ActivityKey;
    currentSubmission?: Submission;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [stRes, subRes] = await Promise.all([
      supabase.from('students').select('*').order('lastname'),
      supabase.from('submissions').select('*')
    ]);
    
    if (stRes.data) setStudents(stRes.data);
    if (subRes.data) setSubmissions(subRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => closeContextMenu();
    if (contextMenu?.visible) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [contextMenu?.visible]);

  const studentsWithData = useMemo(() => {
    return students.map(st => {
      const stSubs = submissions.filter(sub => sub.student_id === st.id);
      const subMap = {} as Record<ActivityKey, Submission>;
      ACTIVITIES.forEach(act => {
        const found = stSubs.find(s => s.activity_key === act);
        if (found) subMap[act] = found;
      });

      // Check progression warning (an activity has progress, but an earlier one is pending/missing)
      let hasWarning = false;
      let highestActiveIndex = -1;
      
      for (let i = 0; i < ACTIVITIES.length; i++) {
        const status = subMap[ACTIVITIES[i]]?.status || 'pending';
        if (['pass', 'resubmit', 'oral'].includes(status)) {
          highestActiveIndex = i;
        }
      }

      if (highestActiveIndex > 0) {
        for (let i = 0; i < highestActiveIndex; i++) {
          const status = subMap[ACTIVITIES[i]]?.status || 'pending';
          if (status === 'pending' || status === 'missing') {
            hasWarning = true;
            break;
          }
        }
      }

      return { ...st, submissions: subMap, hasProgressionWarning: hasWarning };
    });
  }, [students, submissions]);

  const stats = useMemo(() => {
    const s = { pass: 0, resubmit: 0, oral: 0, missing: 0 };
    submissions.forEach(sub => {
      if (sub.status === 'pass') s.pass++;
      else if (sub.status === 'resubmit') s.resubmit++;
      else if (sub.status === 'oral') s.oral++;
      else if (sub.status === 'missing') s.missing++;
    });
    return s;
  }, [submissions]);

  const handleBulkAdd = async () => {
    const lines = bulkInput.split('\n').filter(l => l.trim().length > 0);
    const newStudents = lines.map(line => {
      let parts = line.split(',');
      if (parts.length === 1) {
        parts = line.trim().split(/\s+/);
      }
      return {
        lastname: parts[0]?.trim() || '',
        firstname: parts.slice(1).join(' ').trim() || ''
      };
    }).filter(s => s.lastname && s.firstname);

    if (newStudents.length > 0) {
      setLoading(true);
      await supabase.from('students').insert(newStudents);
      setBulkInput('');
      setAddModalOpen(false);
      await fetchData();
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedStudents.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedStudents.size} student(s)?`)) return;

    setLoading(true);
    await supabase.from('students').delete().in('id', Array.from(selectedStudents));
    setSelectedStudents(new Set());
    await fetchData();
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;

    setLoading(true);
    await supabase.from('students').delete().eq('id', studentId);
    setSelectedStudents(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
    await fetchData();
  };

  const handleStatusCycle = async (studentId: string, activityKey: ActivityKey, currentStatus: SubmissionStatus | undefined) => {
    const newStatus = NEXT_STATUS[currentStatus || 'pending'];
    await upsertSubmission(studentId, activityKey, { status: newStatus });
  };

  const setStatusAndClose = async (status: SubmissionStatus) => {
    if (!contextMenu) return;
    await upsertSubmission(contextMenu.studentId, contextMenu.activityKey, { status });
    closeContextMenu();
  };

  const toggleRemark = async (remark: Remark) => {
    if (!contextMenu) return;
    const currentRemarks = contextMenu.currentSubmission?.remarks || [];
    let newRemarks = [...currentRemarks];
    if (newRemarks.includes(remark)) {
      newRemarks = newRemarks.filter(r => r !== remark);
    } else {
      newRemarks.push(remark);
    }
    await upsertSubmission(contextMenu.studentId, contextMenu.activityKey, { remarks: newRemarks });
    
    // Update local context menu state so it feels responsive before refetch
    setContextMenu(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentSubmission: prev.currentSubmission 
          ? { ...prev.currentSubmission, remarks: newRemarks }
          : { id: '', student_id: prev.studentId, activity_key: prev.activityKey, status: 'pending', remarks: newRemarks, updated_at: '' }
      };
    });
  };

  const upsertSubmission = async (studentId: string, activityKey: ActivityKey, updates: Partial<Submission>) => {
    // Optimistic UI update
    setSubmissions(prev => {
      const existingIdx = prev.findIndex(s => s.student_id === studentId && s.activity_key === activityKey);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...updates };
        return next;
      } else {
        return [...prev, { student_id: studentId, activity_key: activityKey, status: 'pending', remarks: [], updated_at: '', id: 'temp', ...updates } as Submission];
      }
    });

    const existing = submissions.find(s => s.student_id === studentId && s.activity_key === activityKey);
    const payload = existing 
      ? { ...existing, ...updates, updated_at: new Date().toISOString() }
      : { student_id: studentId, activity_key: activityKey, status: 'pending', remarks: [], ...updates, updated_at: new Date().toISOString() };
    
    // Remote update
    await supabase.from('submissions').upsert(payload, { onConflict: 'student_id,activity_key' });
    
    // Background refresh
    const { data } = await supabase.from('submissions').select('*');
    if (data) setSubmissions(data);
  };

  const handleExportCSV = () => {
    const data = studentsWithData.map(st => {
      const row: any = {
        'Last Name': st.lastname,
        'First Name': st.firstname,
        'Warning': st.hasProgressionWarning ? 'YES' : 'NO'
      };
      
      ACTIVITIES.forEach(act => {
        const sub = st.submissions[act];
        row[`${act} Status`] = sub?.status || 'pending';
        row[`${act} Remarks`] = (sub?.remarks || []).join('; ');
      });
      return row;
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'activity_tracker_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Activity Tracker Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/view" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Student View
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats & Actions */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden divide-x divide-slate-200">
            <div className="px-5 py-3 text-sm">
              <span className="block text-slate-500 font-medium">Pass</span>
              <span className="block text-xl font-bold text-emerald-600">{stats.pass}</span>
            </div>
            <div className="px-5 py-3 text-sm">
              <span className="block text-slate-500 font-medium">Resubmit</span>
              <span className="block text-xl font-bold text-amber-600">{stats.resubmit}</span>
            </div>
            <div className="px-5 py-3 text-sm">
              <span className="block text-slate-500 font-medium">Oral</span>
              <span className="block text-xl font-bold text-purple-600">{stats.oral}</span>
            </div>
            <div className="px-5 py-3 text-sm">
              <span className="block text-slate-500 font-medium">Missing</span>
              <span className="block text-xl font-bold text-rose-600">{stats.missing}</span>
            </div>
          </div>

          <div className="flex gap-3">
            {selectedStudents.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-rose-700 transition"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedStudents.size})
              </button>
            )}
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              Bulk Add Students
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-md font-medium text-sm hover:bg-slate-50 transition"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Matrix */}
        <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-xl overflow-x-auto w-full">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700 w-10 sticky left-0 bg-slate-50">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={students.length > 0 && selectedStudents.size === students.length}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 w-[200px] sticky left-10 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">Student</th>
                {ACTIVITIES.map(act => (
                  <th key={act} className="px-4 py-3 font-semibold text-slate-700 text-center border-l w-32 border-slate-200">
                    {act.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={ACTIVITIES.length + 2} className="px-4 py-8 text-center text-slate-500">
                    Loading dashboard...
                  </td>
                </tr>
              ) : studentsWithData.map(st => (
                <tr key={st.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedStudents.has(st.id)}
                      onChange={() => toggleStudentSelection(st.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 sticky left-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <span>{st.lastname}, {st.firstname}</span>
                      <div className="flex items-center gap-2">
                        {st.hasProgressionWarning && (
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" title="Progression Warning: Missing earlier activities" />
                        )}
                        <button onClick={() => handleDeleteStudent(st.id, `${st.lastname}, ${st.firstname}`)} className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                  {ACTIVITIES.map(act => {
                    const sub = st.submissions[act];
                    const status = sub?.status || 'pending';
                    const hasRemarks = (sub?.remarks && sub.remarks.length > 0) || false;

                    return (
                      <td 
                        key={act} 
                        className="px-0 py-0 border-l border-slate-200 relative align-middle"
                        onClick={() => handleStatusCycle(st.id, act, sub?.status)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            studentId: st.id,
                            activityKey: act,
                            currentSubmission: sub
                          });
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-indigo-50/50">
                          <StatusIcon status={status} className="h-5 w-5" />
                          {hasRemarks && (
                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" title="Has Remarks" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Context Menu Modal / Dropdown */}
      {contextMenu && contextMenu.visible && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-64 p-2 text-sm origin-top-left"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // Prevent close
        >
          <div className="font-semibold px-2 py-1 flex justify-between items-center text-slate-800 mb-1">
            <span>Set Status</span>
            <button onClick={closeContextMenu} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4"/></button>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {Object.entries({
              pending: 'Pending',
              pass: 'Pass',
              resubmit: 'Resubmit',
              oral: 'Oral',
              missing: 'Missing'
            }).map(([key, label]) => (
              <button
                key={key}
                className="text-left px-2 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2"
                onClick={() => setStatusAndClose(key as SubmissionStatus)}
              >
                <StatusIcon status={key as SubmissionStatus} className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 my-1 pt-1"></div>
          <div className="font-semibold px-2 py-1 text-slate-800 mb-1">Add Remarks</div>
          <div className="space-y-1">
            {Object.entries(REMARK_LABELS).map(([remarkKey, label]) => {
              const isChecked = contextMenu.currentSubmission?.remarks?.includes(remarkKey as Remark) || false;
              return (
                <label key={remarkKey} className="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isChecked}
                    onChange={() => toggleRemark(remarkKey as Remark)}
                  />
                  <span className="text-slate-700 leading-snug">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Bulk Add Students</h2>
              <button onClick={() => setAddModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Paste a list of students (Lastname Firstname or Lastname, Firstname). One student per line.
              </p>
              <textarea
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                className="w-full h-48 rounded-md border border-slate-300 shadow-sm p-3 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Doe, John&#10;Smith Jane"
              ></textarea>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdd}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700"
              >
                Add Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
