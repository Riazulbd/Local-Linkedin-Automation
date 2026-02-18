'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ColumnMapping, CSVLeadRow } from '@/types';
import { CSVImportMapper } from '@/components/leads-folders/CSVImportMapper';
import { useProfileStore } from '@/store/profileStore';

export default function LeadImportPage() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);

  const [rows, setRows] = useState<CSVLeadRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  function onFileSelected(file: File) {
    setError(null);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as Record<string, string>[]).map((row) => row as CSVLeadRow);
        setRows(parsed);
      },
      error: (parseError) => {
        setError(parseError.message);
      },
    });
  }

  async function uploadMappedRows() {
    if (!selectedProfile?.id) {
      setError('Select a profile before importing leads.');
      return;
    }
    if (!rows.length) {
      setError('Upload a CSV file first.');
      return;
    }

    const mappedRows = rows.map((row) => {
      const mapped: CSVLeadRow = { linkedin_url: '' };
      for (const map of mapping) {
        if (map.field === 'ignore') continue;
        mapped[map.field] = row[map.csv_header];
      }
      return mapped;
    });

    const leads = mappedRows
      .filter((row) => row.linkedin_url && row.linkedin_url.includes('linkedin.com/in/'))
      .map((row) => ({
        linkedin_url: row.linkedin_url,
        first_name: row.first_name,
        last_name: row.last_name,
        company: row.company,
        title: row.title,
      }));

    if (!leads.length) {
      setError('No valid LinkedIn profile URLs found after mapping.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          leads,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { inserted?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to upload leads');
      setMessage(`Uploaded ${payload.inserted ?? leads.length} leads.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload leads');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1100 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            CSV Lead Import
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Parse CSV, map columns, and bulk upload leads into the selected profile.
          </Typography>
        </Box>
        <Button component={Link} href="/leads" variant="outlined">
          Back to Leads
        </Button>
      </Stack>

      {!selectedProfile?.id && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Select a profile from the profile selector before importing leads.
        </Alert>
      )}
      {selectedProfile?.id && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Import target profile: <strong>{selectedProfile.name}</strong>
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField
          type="file"
          inputProps={{ accept: '.csv,text/csv' }}
          onChange={(event) => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0];
            if (file) onFileSelected(file);
          }}
          fullWidth
          helperText="Choose a CSV file with LinkedIn profile URL columns."
        />
      </Paper>

      <CSVImportMapper rows={previewRows} onChange={setMapping} />

      <Stack direction="row" justifyContent="flex-end" mt={3}>
        <Button
          variant="contained"
          onClick={() => uploadMappedRows().catch(() => undefined)}
          disabled={isUploading || !rows.length}
        >
          {isUploading ? 'Uploading...' : 'Upload Leads'}
        </Button>
      </Stack>
    </Box>
  );
}
