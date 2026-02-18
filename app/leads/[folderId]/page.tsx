'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Lead, LeadFolder, LeadStatus } from '@/types';

type LeadFilterStatus = 'all' | LeadStatus;

interface FolderPayload {
  folder?: LeadFolder;
  error?: string;
}

interface LeadsPayload {
  leads?: Lead[];
  data?: Lead[];
  error?: string;
}

interface FoldersPayload {
  folders?: LeadFolder[];
  error?: string;
}

interface LeadDraft {
  linkedin_url: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  status: LeadStatus;
  folder_id: string;
}

const STATUS_OPTIONS: LeadStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped'];

export default function LeadFolderDetailPage() {
  const params = useParams<{ folderId: string }>();
  const folderId = String(params?.folderId || '');

  const [folder, setFolder] = useState<LeadFolder | null>(null);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadFilterStatus>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editDraft, setEditDraft] = useState<LeadDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadFolderData = useCallback(async () => {
    if (!folderId) return;

    setLoading(true);
    setError(null);
    try {
      const [folderRes, leadsRes, foldersRes] = await Promise.all([
        fetch(`/api/lead-folders/${encodeURIComponent(folderId)}`, { cache: 'no-store' }),
        fetch(`/api/lead-folders/${encodeURIComponent(folderId)}/leads`, { cache: 'no-store' }),
        fetch('/api/lead-folders', { cache: 'no-store' }),
      ]);

      const folderPayload = (await folderRes.json().catch(() => ({}))) as FolderPayload;
      const leadsPayload = (await leadsRes.json().catch(() => ({}))) as LeadsPayload;
      const foldersPayload = (await foldersRes.json().catch(() => ({}))) as FoldersPayload;

      if (!folderRes.ok) throw new Error(folderPayload.error || 'Failed to load folder');
      if (!leadsRes.ok) throw new Error(leadsPayload.error || 'Failed to load folder leads');
      if (!foldersRes.ok) throw new Error(foldersPayload.error || 'Failed to load folders');

      setFolder(folderPayload.folder ?? null);
      setLeads(leadsPayload.leads ?? leadsPayload.data ?? []);
      setFolders(foldersPayload.folders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load folder');
      setFolder(null);
      setLeads([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    void loadFolderData();
  }, [loadFolderData]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const query = search.trim().toLowerCase();
      const haystack = [
        lead.first_name || '',
        lead.last_name || '',
        lead.company || '',
        lead.title || '',
        lead.linkedin_url || '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setEditDraft({
      linkedin_url: lead.linkedin_url,
      first_name: lead.first_name ?? '',
      last_name: lead.last_name ?? '',
      company: lead.company ?? '',
      title: lead.title ?? '',
      status: lead.status,
      folder_id: lead.folder_id ?? '',
    });
  };

  const closeEditDialog = () => {
    setEditingLead(null);
    setEditDraft(null);
    setSaving(false);
  };

  const saveLead = async () => {
    if (!editingLead || !editDraft) return;
    if (!editDraft.linkedin_url.trim()) {
      setError('LinkedIn URL is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${editingLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: editDraft.linkedin_url.trim(),
          first_name: editDraft.first_name.trim() || null,
          last_name: editDraft.last_name.trim() || null,
          company: editDraft.company.trim() || null,
          title: editDraft.title.trim() || null,
          status: editDraft.status,
          folder_id: editDraft.folder_id || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update lead');
      }

      closeEditDialog();
      await loadFolderData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update lead');
      setSaving(false);
    }
  };

  const deleteLead = async () => {
    if (!deletingLead) return;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${deletingLead.id}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete lead');
      }

      setDeletingLead(null);
      await loadFolderData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {folder?.name || 'Folder'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {folder?.description || 'Leads assigned to this folder.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button component={Link} href="/leads/import" variant="outlined">
            Import CSV
          </Button>
          <Button component={Link} href={`/leads/add-single?folderId=${encodeURIComponent(folderId)}`} variant="contained">
            Add Lead
          </Button>
          <Button component={Link} href="/leads" variant="outlined">
            Back
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(event) => setStatusFilter(event.target.value as LeadFilterStatus)}
            >
              <MenuItem value="all">All</MenuItem>
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Search Leads"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, company, title, LinkedIn URL"
            fullWidth
          />
        </Stack>
      </Paper>

      {loading ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Loading folder...</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>LinkedIn</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} hover>
                  <TableCell>{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'}</TableCell>
                  <TableCell>{lead.company || '—'}</TableCell>
                  <TableCell>{lead.title || '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={lead.status} />
                  </TableCell>
                  <TableCell>
                    <MuiLink href={lead.linkedin_url} target="_blank" rel="noopener">
                      View
                    </MuiLink>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="primary" size="small" onClick={() => openEditDialog(lead)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => setDeletingLead(lead)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography align="center" color="text.secondary" sx={{ py: 3 }}>
                      No leads found for this filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(editingLead && editDraft)} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Edit Lead</DialogTitle>
        <DialogContent>
          {editDraft && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="LinkedIn URL"
                value={editDraft.linkedin_url}
                onChange={(event) =>
                  setEditDraft((prev) => (prev ? { ...prev, linkedin_url: event.target.value } : prev))
                }
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="First Name"
                  value={editDraft.first_name}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, first_name: event.target.value } : prev))
                  }
                  fullWidth
                />
                <TextField
                  label="Last Name"
                  value={editDraft.last_name}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, last_name: event.target.value } : prev))
                  }
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Company"
                  value={editDraft.company}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, company: event.target.value } : prev))
                  }
                  fullWidth
                />
                <TextField
                  label="Title"
                  value={editDraft.title}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                  }
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editDraft.status}
                    label="Status"
                    onChange={(event) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, status: event.target.value as LeadStatus } : prev
                      )
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Folder</InputLabel>
                  <Select
                    value={editDraft.folder_id}
                    label="Folder"
                    onChange={(event) =>
                      setEditDraft((prev) => (prev ? { ...prev, folder_id: String(event.target.value) } : prev))
                    }
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {folders.map((entry) => (
                      <MenuItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancel</Button>
          <Button variant="contained" onClick={() => saveLead().catch(() => undefined)} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deletingLead)} onClose={() => setDeletingLead(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Lead</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove{' '}
            <strong>{`${deletingLead?.first_name || ''} ${deletingLead?.last_name || ''}`.trim() || 'this lead'}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingLead(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => deleteLead().catch(() => undefined)}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
