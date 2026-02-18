'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { CSVLeadRow, ColumnMapping } from '@/types';

const FIELD_OPTIONS: Array<ColumnMapping['field']> = [
  'linkedin_url',
  'first_name',
  'last_name',
  'company',
  'title',
  'ignore',
];

interface CSVImportMapperProps {
  rows: CSVLeadRow[];
  onChange: (mapping: ColumnMapping[]) => void;
}

export function CSVImportMapper({ rows, onChange }: CSVImportMapperProps) {
  const headers = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const [mapping, setMapping] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    const inferred = headers.map((header) => ({ csv_header: header, field: guessField(header) }));
    setMapping(inferred);
    onChange(inferred);
  }, [headers, onChange]);

  function updateField(csvHeader: string, field: ColumnMapping['field']) {
    const next = mapping.map((row) => (row.csv_header === csvHeader ? { ...row, field } : row));
    setMapping(next);
    onChange(next);
  }

  if (!headers.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No CSV preview rows yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
        CSV Column Mapper
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>CSV Header</TableCell>
              <TableCell>Map To</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((header) => (
              <TableRow key={header}>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {header}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FormControl fullWidth size="small">
                    <InputLabel>Field</InputLabel>
                    <Select
                      value={mapping.find((row) => row.csv_header === header)?.field || 'ignore'}
                      label="Field"
                      onChange={(event) => updateField(header, event.target.value as ColumnMapping['field'])}
                    >
                      {FIELD_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function guessField(header: string): ColumnMapping['field'] {
  const normalized = header.trim().toLowerCase();
  if (normalized.includes('linkedin') || normalized.includes('profile url')) return 'linkedin_url';
  if (normalized.includes('first')) return 'first_name';
  if (normalized.includes('last')) return 'last_name';
  if (normalized.includes('company')) return 'company';
  if (normalized.includes('title')) return 'title';
  return 'ignore';
}
