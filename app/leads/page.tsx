'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, Folder } from '@mui/icons-material';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Lead, LeadFolder, LeadStatus } from '@/types';

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

export default function LeadsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editDraft, setEditDraft] = useState<LeadDraft | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const response = await fetch('/api/lead-folders', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as FoldersPayload;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load folders');
      }

      const nextFolders = payload.folders ?? [];
      setFolders(nextFolders);
      setSelectedFolderId((current) => {
        if (current === 'all') return 'all';
        return nextFolders.some((folder) => folder.id === current) ? current : 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadLeads = useCallback(async (folderId: string) => {
    setLoadingLeads(true);
    setError(null);

    const endpoint =
      folderId === 'all'
        ? '/api/leads?limit=300'
        : `/api/lead-folders/${encodeURIComponent(folderId)}/leads`;

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as LeadsPayload;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load leads');
      }
      setLeads((payload.leads ?? payload.data ?? []) as Lead[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadLeads(selectedFolderId);
  }, [loadLeads, selectedFolderId]);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );

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
    setSavingLead(false);
  };

  const saveLeadChanges = async () => {
    if (!editingLead || !editDraft) return;

    if (!editDraft.linkedin_url.trim()) {
      setError('LinkedIn URL is required.');
      return;
    }

    setSavingLead(true);
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

      setToastMessage('Lead updated');
      closeEditDialog();
      await Promise.all([loadLeads(selectedFolderId), loadFolders()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update lead');
      setSavingLead(false);
    }
  };

  const deleteSelectedLead = async () => {
    if (!deletingLead) return;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${deletingLead.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete lead');
      }

      setDeletingLead(null);
      setToastMessage('Lead deleted');
      await Promise.all([loadLeads(selectedFolderId), loadFolders()]);
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
            Leads
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activeFolder ? `Folder: ${activeFolder.name}` : 'All leads'} ({leads.length})
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<Folder />} onClick={() => router.push('/leads/folders')}>
            Manage Folders
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => router.push('/leads/add-single')}>
            Add Lead
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedFolderId}
          onChange={(_, value) => setSelectedFolderId(String(value))}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="all" label="All Leads" />
          {folders.map((folder) => (
            <Tab
              key={folder.id}
              value={folder.id}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{folder.name}</span>
                  <Chip label={folder.lead_count} size="small" />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {loadingFolders || loadingLeads ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress size={26} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Loading leads...
          </Typography>
        </Paper>
      ) : leads.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary" mb={2}>
            No leads found for this view.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/leads/add-single')}>
            Add Lead
          </Button>
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
                <TableCell>Folder</TableCell>
                <TableCell>LinkedIn</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} hover>
                  <TableCell>{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'}</TableCell>
                  <TableCell>{lead.company || '—'}</TableCell>
                  <TableCell>{lead.title || '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={lead.status} />
                  </TableCell>
                  <TableCell>
                    {folders.find((folder) => folder.id === lead.folder_id)?.name || <Typography variant="caption">Unassigned</Typography>}
                  </TableCell>
                  <TableCell>
                    <MuiLink href={lead.linkedin_url} target="_blank" rel="noopener">
                      View
                    </MuiLink>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => openEditDialog(lead)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeletingLead(lead)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
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
                fullWidth
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
                    {folders.map((folder) => (
                      <MenuItem key={folder.id} value={folder.id}>
                        {folder.name}
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
          <Button variant="contained" onClick={() => saveLeadChanges().catch(() => undefined)} disabled={savingLead}>
            {savingLead ? 'Saving...' : 'Save Changes'}
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
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteSelectedLead().catch(() => undefined)}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toastMessage)} autoHideDuration={2200} onClose={() => setToastMessage('')}>
        <Alert onClose={() => setToastMessage('')} severity="success" variant="filled" sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
