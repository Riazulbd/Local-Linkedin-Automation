import { interpolateTemplate } from './template';
import type { Lead } from '../../../types/lead.types';

export function interpolate(template: string, lead: Lead): string {
  return interpolateTemplate(template, lead as unknown as Record<string, unknown>);
}
