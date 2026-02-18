import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { logAppAction } from '@/lib/supabase/queries/action-logs.queries';
import { refreshFolderLeadCount } from '@/lib/supabase/queries/folders.queries';
import { deleteLeadById, getLeadById, updateLead } from '@/lib/supabase/queries/leads.queries';
import type { LeadStatus, UpdateLeadInput } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface RouteContext {
  params: { id: string };
}

const LEAD_STATUS_VALUES: LeadStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped'];

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function pickBodyValue(body: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (hasOwn(body, key)) return body[key];
  }
  return undefined;
}

function parseRequiredTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseNullableText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function ensureProfileExists(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function ensureFolderExists(supabase: SupabaseClient, folderId: string) {
  const { data, error } = await supabase.from('lead_folders').select('id').eq('id', folderId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: RouteContext) {
  noStore();
  try {
    const lead = await getLeadById(createServiceClient(), params.id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ lead, data: lead }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load lead' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const supabase = createServiceClient();
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === 'object'
      ? (rawBody as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const requestSnapshot = {
    id: params.id,
    profile_id: pickBodyValue(body, ['profile_id', 'profileId']) ?? null,
    folder_id: pickBodyValue(body, ['folder_id', 'folderId']) ?? null,
    status: pickBodyValue(body, ['status']) ?? null,
  };

  const rejectWith400 = async (message: string) => {
    await logAppAction(supabase, {
      actionType: 'lead.update',
      entityType: 'lead',
      entityId: params.id,
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: message,
    }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  };

  try {
    const existingLead = await getLeadById(supabase, params.id);
    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const patch: UpdateLeadInput = {};

    const profileValue = pickBodyValue(body, ['profile_id', 'profileId']);
    if (profileValue !== undefined) {
      const profileId = parseRequiredTrimmedString(profileValue);
      if (!profileId) return rejectWith400('profile_id must be a non-empty string');
      const profileExists = await ensureProfileExists(supabase, profileId);
      if (!profileExists) return rejectWith400('Selected profile does not exist');
      patch.profile_id = profileId;
    }

    const folderValue = pickBodyValue(body, ['folder_id', 'folderId']);
    if (folderValue !== undefined) {
      if (folderValue === null || folderValue === '') {
        patch.folder_id = null;
      } else {
        const folderId = parseRequiredTrimmedString(folderValue);
        if (!folderId) return rejectWith400('folder_id must be a string or null');
        const folderExists = await ensureFolderExists(supabase, folderId);
        if (!folderExists) return rejectWith400('Selected folder does not exist');
        patch.folder_id = folderId;
      }
    }

    const linkedinUrlValue = pickBodyValue(body, ['linkedin_url', 'linkedinUrl']);
    if (linkedinUrlValue !== undefined) {
      const linkedinUrl = parseRequiredTrimmedString(linkedinUrlValue);
      if (!linkedinUrl) return rejectWith400('linkedin_url must be a non-empty string');
      patch.linkedin_url = linkedinUrl;
    }

    const statusValue = pickBodyValue(body, ['status']);
    if (statusValue !== undefined) {
      if (typeof statusValue !== 'string' || !LEAD_STATUS_VALUES.includes(statusValue as LeadStatus)) {
        return rejectWith400('Invalid status value');
      }
      patch.status = statusValue as LeadStatus;
    }

    const firstNameValue = pickBodyValue(body, ['first_name', 'firstName']);
    if (firstNameValue !== undefined) {
      if (firstNameValue !== null && typeof firstNameValue !== 'string') {
        return rejectWith400('first_name must be a string or null');
      }
      patch.first_name = parseNullableText(firstNameValue);
    }

    const lastNameValue = pickBodyValue(body, ['last_name', 'lastName']);
    if (lastNameValue !== undefined) {
      if (lastNameValue !== null && typeof lastNameValue !== 'string') {
        return rejectWith400('last_name must be a string or null');
      }
      patch.last_name = parseNullableText(lastNameValue);
    }

    const companyValue = pickBodyValue(body, ['company']);
    if (companyValue !== undefined) {
      if (companyValue !== null && typeof companyValue !== 'string') {
        return rejectWith400('company must be a string or null');
      }
      patch.company = parseNullableText(companyValue);
    }

    const titleValue = pickBodyValue(body, ['title']);
    if (titleValue !== undefined) {
      if (titleValue !== null && typeof titleValue !== 'string') {
        return rejectWith400('title must be a string or null');
      }
      patch.title = parseNullableText(titleValue);
    }

    const notesValue = pickBodyValue(body, ['notes']);
    if (notesValue !== undefined) {
      if (notesValue !== null && typeof notesValue !== 'string') {
        return rejectWith400('notes must be a string or null');
      }
      patch.notes = parseNullableText(notesValue);
    }

    const extraDataValue = pickBodyValue(body, ['extra_data', 'extraData']);
    if (extraDataValue !== undefined) {
      if (
        extraDataValue === null ||
        typeof extraDataValue !== 'object' ||
        Array.isArray(extraDataValue)
      ) {
        return rejectWith400('extra_data must be an object');
      }
      patch.extra_data = extraDataValue as Record<string, string>;
    }

    if (Object.keys(patch).length === 0) {
      return rejectWith400('No updatable fields were provided');
    }

    const updatedLead = await updateLead(supabase, params.id, patch);

    const folderIdsToRefresh = new Set<string>();
    if (existingLead.folder_id) folderIdsToRefresh.add(existingLead.folder_id);
    if (updatedLead.folder_id) folderIdsToRefresh.add(updatedLead.folder_id);

    await Promise.all(
      Array.from(folderIdsToRefresh).map((folderId) =>
        refreshFolderLeadCount(supabase, folderId).catch(() => undefined)
      )
    );

    await logAppAction(supabase, {
      actionType: 'lead.update',
      entityType: 'lead',
      entityId: updatedLead.id,
      status: 'success',
      requestData: requestSnapshot,
      responseData: {
        id: updatedLead.id,
        profile_id: updatedLead.profile_id,
        folder_id: updatedLead.folder_id,
        status: updatedLead.status,
      },
    }).catch(() => undefined);

    return NextResponse.json({ lead: updatedLead, data: updatedLead });
  } catch (error) {
    await logAppAction(supabase, {
      actionType: 'lead.update',
      entityType: 'lead',
      entityId: params.id,
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: error instanceof Error ? error.message : 'Failed to update lead',
    }).catch(() => undefined);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const supabase = createServiceClient();
  const requestSnapshot = { id: params.id };

  try {
    const existingLead = await getLeadById(supabase, params.id);
    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const deletedLead = await deleteLeadById(supabase, params.id);
    if (!deletedLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (deletedLead.folder_id) {
      await refreshFolderLeadCount(supabase, deletedLead.folder_id).catch(() => undefined);
    }

    await logAppAction(supabase, {
      actionType: 'lead.delete',
      entityType: 'lead',
      entityId: params.id,
      status: 'success',
      requestData: requestSnapshot,
      responseData: { deleted: true, folder_id: deletedLead.folder_id },
    }).catch(() => undefined);

    return NextResponse.json({ deleted: true, id: params.id });
  } catch (error) {
    await logAppAction(supabase, {
      actionType: 'lead.delete',
      entityType: 'lead',
      entityId: params.id,
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: error instanceof Error ? error.message : 'Failed to delete lead',
    }).catch(() => undefined);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
