import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useUIStore } from '@/stores/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { X, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/prospects')({
  component: ProspectsPage,
});

interface Prospect {
  id: string;
  firmName: string;
  firmAum?: string;
  firmCountry: string;
  firmDataStack?: string;
  firmExternalDatasets?: string;
  firmPainSignals?: string;
  contactName?: string;
  contactTitle?: string;
  contactLinkedinUrl?: string;
  contactEmail?: string;
  contactRecentActivity?: string;
  contactBackground?: string;
  score: number;
  scoreBreakdown?: string;
  status: string;
  linkedinDraft?: string;
  emailSubjectDraft?: string;
  emailBodyDraft?: string;
  outreachSentAt?: string;
  replyReceivedAt?: string;
  replyNotes?: string;
  meetingBookedAt?: string;
  notes?: string;
  researchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  identified:    { label: 'Identified',    color: '#71717A', bg: '#27272A' },
  researching:   { label: 'Researching',   color: '#F59E0B', bg: '#F59E0B22' },
  researched:    { label: 'Researched',    color: '#3B82F6', bg: '#3B82F622' },
  surfaced:      { label: 'Surfaced',      color: '#8B5CF6', bg: '#8B5CF622' },
  approved:      { label: 'Approved',      color: '#6366F1', bg: '#6366F122' },
  sent_linkedin: { label: 'Sent LinkedIn', color: '#0EA5E9', bg: '#0EA5E922' },
  sent_email:    { label: 'Sent Email',    color: '#0EA5E9', bg: '#0EA5E922' },
  replied:            { label: 'Replied',          color: '#10B981', bg: '#10B98122' },
  linkedin_replied:   { label: 'LinkedIn replied', color: '#10B981', bg: '#10B98122' },
  email_replied:      { label: 'Email replied',    color: '#10B981', bg: '#10B98122' },
  meeting_booked:{ label: 'Meeting',       color: '#10B981', bg: '#10B98122' },
  not_interested:{ label: 'Not interested',color: '#EF4444', bg: '#EF444422' },
  skip:          { label: 'Skipped',       color: '#52525B', bg: '#27272A' },
};

const STATUS_ORDER = ['identified','researching','researched','surfaced','approved','sent_linkedin','sent_email','linkedin_replied','email_replied','replied','meeting_booked','not_interested','skip'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.identified;
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{score}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#FAFAFA] transition-colors px-2 py-1 rounded hover:bg-[#27272A]">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ProspectPanel({ prospect, onClose, onUpdate }: { prospect: Prospect; onClose: () => void; onUpdate: (data: Partial<Prospect>) => void }) {
  const [notes, setNotes] = useState(prospect.notes || '');
  const [replyNotes, setReplyNotes] = useState(prospect.replyNotes || '');
  const [status, setStatus] = useState(prospect.status);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    onUpdate({ notes, replyNotes, status });
    onClose();
  };

  const labelClass = "text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5 block";
  const textareaClass = "w-full px-3 py-2.5 bg-[#27272A] border border-[#3F3F46] rounded-lg text-[#FAFAFA] text-sm placeholder:text-[#52525B] focus:outline-none focus:border-[#6366F1] transition-colors resize-y";

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="w-full max-w-2xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-[#27272A]">
            <div>
              <h2 className="text-base font-semibold text-[#FAFAFA]">{prospect.firmName}</h2>
              {prospect.contactName && (
                <p className="text-sm text-[#71717A] mt-0.5">{prospect.contactName} {prospect.contactTitle ? `· ${prospect.contactTitle}` : ''}</p>
              )}
            </div>
            <button onClick={onClose} className="text-[#52525B] hover:text-[#FAFAFA] transition-colors p-1 rounded-lg hover:bg-[#27272A]">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Status + Score row */}
            <div className="flex items-center gap-6">
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2 bg-[#27272A] border border-[#3F3F46] rounded-lg text-[#FAFAFA] text-sm focus:outline-none focus:border-[#6366F1]">
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>ICP score</label>
                <ScoreBar score={prospect.score} />
              </div>
              <div>
                <label className={labelClass}>AUM</label>
                <p className="text-sm text-[#FAFAFA]">{prospect.firmAum || 'Unknown'}</p>
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <p className="text-sm text-[#FAFAFA]">{prospect.firmCountry}</p>
              </div>
            </div>

            {/* Research notes */}
            {(prospect.firmPainSignals || prospect.firmDataStack || prospect.contactBackground || prospect.contactRecentActivity) && (
              <div className="bg-[#27272A] rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-[#71717A] uppercase tracking-wider">Research</p>
                {prospect.contactBackground && (
                  <div>
                    <p className="text-xs text-[#52525B] mb-1">Background</p>
                    <p className="text-sm text-[#A1A1AA]">{prospect.contactBackground}</p>
                  </div>
                )}
                {prospect.contactRecentActivity && (
                  <div>
                    <p className="text-xs text-[#52525B] mb-1">Recent activity</p>
                    <p className="text-sm text-[#A1A1AA]">{prospect.contactRecentActivity}</p>
                  </div>
                )}
                {prospect.firmPainSignals && (
                  <div>
                    <p className="text-xs text-[#52525B] mb-1">Pain signals</p>
                    <p className="text-sm text-[#A1A1AA]">{prospect.firmPainSignals}</p>
                  </div>
                )}
                {prospect.firmDataStack && (
                  <div>
                    <p className="text-xs text-[#52525B] mb-1">Data stack</p>
                    <p className="text-sm text-[#A1A1AA]">{prospect.firmDataStack}</p>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn draft */}
            {prospect.linkedinDraft && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass} style={{ marginBottom: 0 }}>LinkedIn DM</label>
                  <CopyButton text={prospect.linkedinDraft} />
                </div>
                <div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
                  <p className="text-sm text-[#FAFAFA] whitespace-pre-wrap leading-relaxed">{prospect.linkedinDraft}</p>
                </div>
              </div>
            )}

            {/* Email draft */}
            {(prospect.emailSubjectDraft || prospect.emailBodyDraft) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Email</label>
                  <CopyButton text={`Subject: ${prospect.emailSubjectDraft || ''}\n\n${prospect.emailBodyDraft || ''}`} />
                </div>
                <div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4 space-y-3">
                  {prospect.emailSubjectDraft && (
                    <p className="text-xs text-[#52525B]">Subject: <span className="text-[#FAFAFA]">{prospect.emailSubjectDraft}</span></p>
                  )}
                  {prospect.emailBodyDraft && (
                    <p className="text-sm text-[#FAFAFA] whitespace-pre-wrap leading-relaxed">{prospect.emailBodyDraft}</p>
                  )}
                </div>
              </div>
            )}

            {/* Reply notes */}
            <div>
              <label className={labelClass}>Reply / outcome notes</label>
              <textarea value={replyNotes} onChange={(e) => setReplyNotes(e.target.value)}
                rows={3} placeholder="Log any response or outcome here..."
                className={textareaClass} />
            </div>

            {/* Personal notes */}
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={3} placeholder="Any context, intro paths, next steps..."
                className={textareaClass} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#27272A] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {prospect.contactLinkedinUrl && (
                <a href={prospect.contactLinkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#6366F1] hover:text-[#818CF8] transition-colors">
                  LinkedIn profile
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-[#6366F1] hover:bg-[#818CF8] text-white text-sm font-medium rounded-lg transition-colors">Save</button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

type SortField = 'score' | 'firmName' | 'firmAum' | 'status' | 'firmCountry';

function ProspectsPage() {
  const { sidebarCollapsed } = useUIStore();
  const queryClient = useQueryClient();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterCountry, setFilterCountry] = useState<string>('all');

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['prospects'],
    queryFn: () => api.getProspects(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Prospect> }) => api.updateProspect(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospects'] }),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const ACTIVE_STATUSES = ['identified','researching','researched','surfaced','approved','sent_linkedin','sent_email','linkedin_replied','email_replied','replied','meeting_booked'];
  const filtered = prospects
    .filter((p: Prospect) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return ACTIVE_STATUSES.includes(p.status);
      return p.status === filterStatus;
    })
    .filter((p: Prospect) => filterCountry === 'all' || p.firmCountry === filterCountry)
    .sort((a: Prospect, b: Prospect) => {
      let av: any = a[sortField as keyof Prospect];
      let bv: any = b[sortField as keyof Prospect];
      if (sortField === 'score') { av = a.score || 0; bv = b.score || 0; }
      if (sortField === 'status') { av = STATUS_ORDER.indexOf(a.status); bv = STATUS_ORDER.indexOf(b.status); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={12} className="text-[#52525B]" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-[#6366F1]" /> : <ChevronDown size={12} className="text-[#6366F1]" />;
  };

  const thClass = "px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wider cursor-pointer hover:text-[#FAFAFA] transition-colors select-none";
  const tdClass = "px-4 py-3 text-sm text-[#A1A1AA]";

  const statusGroups = ['all', 'identified', 'researched', 'approved', 'sent_linkedin', 'sent_email', 'linkedin_replied', 'email_replied', 'meeting_booked', 'not_interested', 'skip'];

  return (
    <div className="flex h-screen bg-[#09090B]">
      <Sidebar />
      <motion.div animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }} className="flex-1 flex flex-col overflow-hidden">
        <Header title="Prospects" />
        <main className="flex-1 overflow-hidden flex flex-col px-8 py-6">

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#71717A] font-medium shrink-0">Status:</span>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFilterStatus('active')}
                  className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (filterStatus === 'active' ? 'bg-[#6366F1] text-white' : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA]')}>
                  Active
                </button>
                <button onClick={() => setFilterStatus('all')}
                  className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (filterStatus === 'all' ? 'bg-[#6366F1] text-white' : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA]')}>
                  All
                </button>
                {statusGroups.filter(s => s !== 'all').map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (
                      filterStatus === s ? 'bg-[#6366F1] text-white' : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA]'
                    )}>
                    {STATUS_CONFIG[s]?.label || s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A] font-medium shrink-0">Country:</span>
              {['all', 'UK', 'EU'].map(c => (
                <button key={c} onClick={() => setFilterCountry(c)}
                  className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (
                    filterCountry === c ? 'bg-[#6366F1] text-white' : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA]'
                  )}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <span className="text-xs text-[#52525B] ml-auto shrink-0">{filtered.length} prospects</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto rounded-xl border border-[#27272A]">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-[#52525B] text-sm">Loading...</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-[#18181B] border-b border-[#27272A]">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('firmName')}>
                      <div className="flex items-center gap-1">Firm <SortIcon field="firmName" /></div>
                    </th>
                    <th className={thClass}>Contact</th>
                    <th className={thClass}>Title</th>
                    <th className={thClass} onClick={() => handleSort('firmAum')}>
                      <div className="flex items-center gap-1">AUM <SortIcon field="firmAum" /></div>
                    </th>
                    <th className={thClass} onClick={() => handleSort('firmCountry')}>
                      <div className="flex items-center gap-1">Country <SortIcon field="firmCountry" /></div>
                    </th>
                    <th className={thClass} onClick={() => handleSort('score')}>
                      <div className="flex items-center gap-1">Score <SortIcon field="score" /></div>
                    </th>
                    <th className={thClass} onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                    </th>
                    <th className={thClass}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {filtered.map((p: Prospect) => (
                    <tr key={p.id} onClick={() => setSelectedProspect(p)}
                      className="hover:bg-[#18181B] cursor-pointer transition-colors">
                      <td className={tdClass}>
                        <span className="font-medium text-[#FAFAFA]">{p.firmName}</span>
                      </td>
                      <td className={tdClass}>{p.contactName || <span className="text-[#52525B]">Not researched</span>}</td>
                      <td className={tdClass}>{p.contactTitle || <span className="text-[#52525B]">--</span>}</td>
                      <td className={tdClass}>{p.firmAum || '--'}</td>
                      <td className={tdClass}>
                        <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (p.firmCountry === 'UK' ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#1a2e1a] text-[#4ade80]')}>
                          {p.firmCountry}
                        </span>
                      </td>
                      <td className={tdClass}><ScoreBar score={p.score || 0} /></td>
                      <td className={tdClass}><StatusBadge status={p.status} /></td>
                      <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 flex-wrap">
                          {p.status === 'researched' && (
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'approved' } })}
                              className="text-xs px-2 py-1 bg-[#6366F1] text-white rounded-md hover:bg-[#818CF8] transition-colors">
                              Approve
                            </button>
                          )}
                          {p.status === 'approved' && (<>
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'sent_linkedin', outreachSentAt: new Date().toISOString() } })}
                              className="text-xs px-2 py-1 bg-[#0EA5E9] text-white rounded-md hover:bg-[#38BDF8] transition-colors">
                              LinkedIn sent
                            </button>
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'sent_email', outreachSentAt: new Date().toISOString() } })}
                              className="text-xs px-2 py-1 bg-[#6366F1] text-white rounded-md hover:bg-[#818CF8] transition-colors">
                              Email sent
                            </button>
                          </>)}
                          {p.status === 'sent_linkedin' && (
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'linkedin_replied', replyReceivedAt: new Date().toISOString() } })}
                              className="text-xs px-2 py-1 bg-[#10B981] text-white rounded-md hover:bg-[#34D399] transition-colors">
                              Replied
                            </button>
                          )}
                          {p.status === 'sent_email' && (
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'email_replied', replyReceivedAt: new Date().toISOString() } })}
                              className="text-xs px-2 py-1 bg-[#10B981] text-white rounded-md hover:bg-[#34D399] transition-colors">
                              Replied
                            </button>
                          )}
                          {['linkedin_replied','email_replied'].includes(p.status) && (
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'meeting_booked', meetingBookedAt: new Date().toISOString() } })}
                              className="text-xs px-2 py-1 bg-[#10B981] text-white rounded-md hover:bg-[#34D399] transition-colors">
                              Meeting booked
                            </button>
                          )}
                          {!['not_interested', 'skip', 'meeting_booked'].includes(p.status) && (
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'skip' } })}
                              className="text-xs px-2 py-1 bg-[#27272A] text-[#71717A] rounded-md hover:text-[#EF4444] transition-colors">
                              Skip
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </motion.div>

      <AnimatePresence>
        {selectedProspect && (
          <ProspectPanel
            prospect={selectedProspect}
            onClose={() => setSelectedProspect(null)}
            onUpdate={(data) => updateMutation.mutate({ id: selectedProspect.id, data })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
