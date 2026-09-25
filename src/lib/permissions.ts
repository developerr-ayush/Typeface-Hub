import type { ApiScope, Role } from './db/schema';

export const ROLES: Role[] = ['viewer', 'editor', 'publisher', 'admin'];
const rank: Record<Role, number> = { viewer: 0, editor: 1, publisher: 2, admin: 3 };

export type Permission =
  | 'read'
  | 'upload' // add fonts, create drafts
  | 'edit' // edit family metadata, faces in draft, tokens
  | 'publish' // publish, rollback, archive, restore
  | 'licence' // edit licence records
  | 'delete'
  | 'settings' // workspace settings, members, API keys
  ;

const minimum: Record<Permission, Role> = {
  read: 'viewer',
  upload: 'editor',
  edit: 'editor',
  publish: 'publisher',
  licence: 'admin',
  delete: 'admin',
  settings: 'admin',
};

const scopeGrants: Record<ApiScope, Permission[]> = {
  delivery: ['read'],
  read: ['read'],
  write: ['read', 'upload', 'edit'],
  publish: ['read', 'upload', 'edit', 'publish'],
};

export function roleCan(role: Role, permission: Permission) {
  return rank[role] >= rank[minimum[permission]];
}

export function scopesCan(scopes: ApiScope[], permission: Permission) {
  return scopes.some((s) => scopeGrants[s]?.includes(permission));
}

export const roleDescriptions: Record<Role, string> = {
  viewer: 'Can browse the library, specimens, tokens and activity.',
  editor: 'Can add fonts, edit drafts, family details and typography tokens.',
  publisher: 'Everything an editor can do, plus publish, roll back and archive.',
  admin: 'Full control: licences, deletion, members, API keys and settings.',
};
