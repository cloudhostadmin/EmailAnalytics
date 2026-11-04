/**
 * Files sent with replies. A file is uploaded for one reply, or kept in the saved library (bank details,
 * catalogue, order form) and attached to any reply with one click. Files are stored in the database and
 * sent with the reply through Gmail.
 */
import { one, q } from './db';
import { HttpError } from './http';
import type { SessionUser } from './auth';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Gmail accepts up to 25 MB per message; base64 makes files about a third larger
export const MAX_REPLY_BYTES = 18 * 1024 * 1024;
const BLOCKED = /\.(exe|bat|cmd|com|msi|scr|vbs|vbe|js|jse|wsf|wsh|ps1|jar|cpl|dll|lnk|hta|reg)$/i;

export interface AttachmentMeta {
	id: number;
	name: string;
	filename: string;
	content_type: string;
	size: number;
	saved: boolean;
}
const META = 'id, name, filename, content_type, size, saved';

function decodeUpload(input: { filename?: string; contentType?: string; base64?: string }) {
	const filename = String(input.filename || '').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim().slice(0, 180);
	if (!filename) throw new HttpError(400, 'The file has no name');
	if (BLOCKED.test(filename)) throw new HttpError(400, 'Program and script files cannot be sent by email');
	const b64 = String(input.base64 || '').replace(/^data:[^,]*,/, '');
	const data = Buffer.from(b64, 'base64');
	if (!data.length) throw new HttpError(400, `${filename} is empty`);
	if (data.length > MAX_FILE_BYTES) throw new HttpError(400, `${filename} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
	const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(String(input.contentType || '')) ? String(input.contentType) : 'application/octet-stream';
	return { filename, contentType, data };
}

async function draftForEdit(user: SessionUser, draftId: number) {
	const d = await one<any>('select id, status, attachment_ids from reply_drafts where id=$1 and org_id=$2', [draftId, user.orgId]);
	if (!d) throw new HttpError(404, 'Draft not found');
	if (d.status === 'sent') throw new HttpError(400, 'This reply has already been sent');
	return d as { id: number; status: string; attachment_ids: number[] };
}

async function totalBytes(ids: number[]) {
	if (!ids.length) return 0;
	return (await one<any>('select coalesce(sum(size),0)::bigint n from attachments where id = any($1)', [ids]))?.n * 1 || 0;
}

export async function draftAttachments(orgId: number, draftId: number): Promise<AttachmentMeta[]> {
	return q<AttachmentMeta>(
		`select a.id, a.name, a.filename, a.content_type, a.size, a.saved from attachments a join reply_drafts d on a.id = any(d.attachment_ids)
		  where d.id=$1 and d.org_id=$2 order by array_position(d.attachment_ids, a.id)`,
		[draftId, orgId],
	);
}

/** Upload a file for one reply. */
export async function addDraftAttachment(user: SessionUser, draftId: number, input: { filename?: string; contentType?: string; base64?: string }) {
	const d = await draftForEdit(user, draftId);
	const f = decodeUpload(input);
	if ((await totalBytes(d.attachment_ids)) + f.data.length > MAX_REPLY_BYTES)
		throw new HttpError(400, `The files on one reply can add up to ${MAX_REPLY_BYTES / 1024 / 1024} MB`);
	const row = await one<any>(
		`insert into attachments (org_id, filename, content_type, size, data, created_by) values ($1,$2,$3,$4,$5,$6) returning id`,
		[user.orgId, f.filename, f.contentType, f.data.length, f.data, user.id],
	);
	await q(`update reply_drafts set attachment_ids = attachment_ids || $2::bigint, updated_at=now(), updated_by=$3 where id=$1`, [draftId, row.id, user.id]);
	return draftAttachments(user.orgId, draftId);
}

/** Attach a file from the saved library. */
export async function attachSaved(user: SessionUser, draftId: number, attachmentId: number) {
	const d = await draftForEdit(user, draftId);
	const a = await one<any>('select id, size from attachments where id=$1 and org_id=$2 and saved', [attachmentId, user.orgId]);
	if (!a) throw new HttpError(404, 'That saved file no longer exists');
	if (!d.attachment_ids.map(Number).includes(Number(a.id))) {
		if ((await totalBytes(d.attachment_ids)) + a.size > MAX_REPLY_BYTES)
			throw new HttpError(400, `The files on one reply can add up to ${MAX_REPLY_BYTES / 1024 / 1024} MB`);
		await q(`update reply_drafts set attachment_ids = attachment_ids || $2::bigint, updated_at=now(), updated_by=$3 where id=$1`, [draftId, a.id, user.id]);
	}
	return draftAttachments(user.orgId, draftId);
}

/** Take a file off a reply; a file uploaded only for this reply is deleted. */
export async function removeDraftAttachment(user: SessionUser, draftId: number, attachmentId: number) {
	await draftForEdit(user, draftId);
	await q(`update reply_drafts set attachment_ids = array_remove(attachment_ids, $2::bigint), updated_at=now(), updated_by=$3 where id=$1`, [draftId, attachmentId, user.id]);
	await q(
		`delete from attachments a where a.id=$1 and a.org_id=$2 and not a.saved
		   and not exists (select 1 from reply_drafts d where a.id = any(d.attachment_ids))`,
		[attachmentId, user.orgId],
	);
	return draftAttachments(user.orgId, draftId);
}

/** The files for sending, in the order they were attached. */
export async function attachmentsForSend(ids: number[]) {
	if (!ids?.length) return [];
	const rows = await q<any>('select id, filename, content_type, data from attachments where id = any($1)', [ids]);
	const byId = new Map(rows.map((r) => [Number(r.id), r]));
	return ids
		.map((id) => byId.get(Number(id)))
		.filter(Boolean)
		.map((r: any) => ({ filename: r.filename, contentType: r.content_type, base64: Buffer.from(r.data).toString('base64') }));
}

// ── Saved library ───────────────────────────────────────────────────────────
export async function listSaved(orgId: number): Promise<AttachmentMeta[]> {
	return q<AttachmentMeta>(`select ${META} from attachments where org_id=$1 and saved order by lower(name), id`, [orgId]);
}

export async function addSaved(user: SessionUser, input: { name?: string; filename?: string; contentType?: string; base64?: string }) {
	const f = decodeUpload(input);
	const name = String(input.name || '').trim().slice(0, 120) || f.filename.replace(/\.[^.]+$/, '');
	await q(
		`insert into attachments (org_id, saved, name, filename, content_type, size, data, created_by) values ($1,true,$2,$3,$4,$5,$6,$7)`,
		[user.orgId, name, f.filename, f.contentType, f.data.length, f.data, user.id],
	);
	return listSaved(user.orgId);
}

/** Remove from the library; replies that already carry the file keep it. */
export async function removeSaved(user: SessionUser, id: number) {
	await q(
		`delete from attachments a where a.id=$1 and a.org_id=$2 and a.saved
		   and not exists (select 1 from reply_drafts d where a.id = any(d.attachment_ids))`,
		[id, user.orgId],
	);
	await q('update attachments set saved=false where id=$1 and org_id=$2', [id, user.orgId]);
	return listSaved(user.orgId);
}

export async function attachmentFile(orgId: number, id: number) {
	return one<any>('select id, saved, filename, content_type, size, data from attachments where id=$1 and org_id=$2', [id, orgId]);
}
