import type { HttpClient } from './http.js';
import type { CreateSectionInput, Section, UpdateSectionInput } from './types.js';

interface RawSection {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_live: boolean;
  is_default_on: boolean;
  sibling_rank: number;
}

interface CreateSectionResponse {
  section: RawSection;
}

interface UpdateSectionResponse {
  section: RawSection;
}

/**
 * List all sections for the publication.
 */
export async function listSections(http: HttpClient): Promise<Section[]> {
  const raw = await http.get<RawSection[]>('publication/sections');

  return raw.map(mapSection);
}

/**
 * Create a new section.
 *
 * The section is immediately usable for assigning posts even while `port_status` is "porting".
 * The slug is auto-generated from the name.
 */
export async function createSection(http: HttpClient, input: CreateSectionInput): Promise<Section> {
  const payload: Record<string, unknown> = {
    name: input.name,
  };

  if (input.description) {
    payload.description = input.description;
  }

  const response = await http.post<CreateSectionResponse>('publication/sections', payload);

  return mapSection(response.section);
}

/**
 * Update an existing section.
 *
 * Note: The slug does NOT change when the name is updated.
 * Uses PATCH method.
 */
export async function updateSection(
  http: HttpClient,
  id: number,
  input: UpdateSectionInput,
): Promise<Section> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.description !== undefined) {
    payload.description = input.description;
  }

  const response = await http.patch<UpdateSectionResponse>(`publication/sections/${id}`, payload);

  return mapSection(response.section);
}

/**
 * Delete a section.
 *
 * Deleting a section does not delete posts within it — they become unassigned.
 */
export async function deleteSection(http: HttpClient, id: number): Promise<void> {
  await http.delete(`publication/sections/${id}`);
}

function mapSection(raw: RawSection): Section {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    isLive: raw.is_live ?? false,
    isDefaultOn: raw.is_default_on ?? true,
    siblingRank: raw.sibling_rank ?? 0,
  };
}
