'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Delete, Edit, FolderOpen, PlusOne } from '@mui/icons-material';
import type { LeadFolder } from '@/types';

interface FoldersPayload {
  folders?: LeadFolder[];
  error?: string;
}

interface FolderPayload {
  folder?: LeadFolder;
  error?: string;
}

export default function LeadFoldersPage() {
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);

  const [editingFolder, setEditingFolder] = useState<LeadFolder | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingFolder, setDeletingFolder] = useState<LeadFolder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-folders', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as FoldersPayload;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load folders');
      }
      setFolders(payload.folders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const createFolder = async () => {
    if (!newName.trim()) {
      setError('Folder name is required.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          color: newColor.trim() || '#3B82F6',
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as FolderPayload;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create folder');
      }

      setNewName('');
      setNewDescription('');
      setNewColor('#3B82F6');
      setToastMessage('Folder created');
      await loadFolders();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (folder: LeadFolder) => {
    setEditingFolder(folder);
    setEditName(folder.name);
    setEditDescription(folder.description ?? '');
    setEditColor(folder.color || '#3B82F6');
  };

  const saveFolder = async () => {
    if (!editingFolder) return;
    if (!editName.trim()) {
      setError('Folder name is required.');
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      const response = await fetch(`/api/lead-folders/${editingFolder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          color: editColor.trim() || '#3B82F6',
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as FolderPayload;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update folder');
      }

      setEditingFolder(null);
      setToastMessage('Folder updated');
      await loadFolders();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update folder');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteFolder = async () => {
    if (!deletingFolder) return;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/lead-folders/${deletingFolder.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete folder');
      }

      setDeletingFolder(null);
      setToastMessage('Folder deleted');
      await loadFolders();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete folder');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Manage Lead Folders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create, update, and remove folders used by leads and campaigns.
          </Typography>
        </Box>
        <Button component={Link} href="/leads" variant="outlined">
          Back to Leads
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          New Folder
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Folder Name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Description"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            fullWidth
          />
          <TextField
            label="Color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            sx={{ minWidth: 140 }}
          />
          <Button
            variant="contained"
            startIcon={<PlusOne />}
            onClick={() => createFolder().catch(() => undefined)}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress size={26} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Loading folders...
          </Typography>
        </Paper>
      ) : folders.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">No folders found. Create one to start organizing leads.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Folder</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Lead Count</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: folder.color || 'primary.main',
                          border: 1,
                          borderColor: 'divider',
                        }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {folder.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{folder.description || '—'}</TableCell>
                  <TableCell>{folder.lead_count}</TableCell>
                  <TableCell>{new Date(folder.updated_at).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open Folder">
                      <IconButton component={Link} href={`/leads/${folder.id}`} size="small" color="info">
                        <FolderOpen fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Folder">
                      <IconButton size="small" color="primary" onClick={() => openEditDialog(folder)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Folder">
                      <IconButton size="small" color="error" onClick={() => setDeletingFolder(folder)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(editingFolder)} onClose={() => setEditingFolder(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Folder</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Folder Name" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <TextField
              label="Description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
            <TextField label="Color" value={editColor} onChange={(event) => setEditColor(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingFolder(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveFolder().catch(() => undefined)} disabled={savingEdit}>
            {savingEdit ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deletingFolder)} onClose={() => setDeletingFolder(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete <strong>{deletingFolder?.name}</strong>? Leads stay in the database and become unassigned.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingFolder(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteFolder().catch(() => undefined)}
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
