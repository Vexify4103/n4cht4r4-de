"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { CREATE_ROLE } from "@/lib/role-picker";

export const ROLE_PICKER_KEY = "/api/admin/discord/roles";
export type RoleOption = { id: string; name: string; color: number; assignable: boolean };
export type RolePickerData = { configured: boolean; roles: RoleOption[]; error?: string };

/**
 * Form fields `discordRoleId` + `discordRoleName`: pick a server role, or create a new one on save.
 * Falls back to typing the ID when the bot is not configured.
 */
export function DiscordRolePicker({
	currentId,
	currentName,
	newRoleName,
	picker,
	hint,
}: {
	currentId?: string;
	currentName?: string;
	newRoleName?: string;
	picker?: RolePickerData;
	hint: string;
}) {
	const { text } = useLocale();
	const [selected, setSelected] = useState(currentId || "");
	const [newName, setNewName] = useState(newRoleName || "");
	// After saving, follow the stored role so a second save does not create the role again.
	useEffect(() => setSelected(currentId || ""), [currentId]);
	if (!picker?.configured)
		return (
			<>
				<label>
					{text("Discord role ID", "Discord-Rollen-ID")}
					<input name="discordRoleId" defaultValue={currentId} inputMode="numeric" autoComplete="off" spellCheck={false} />
				</label>
				<label>
					{text("Discord role name", "Discord-Rollenname")}
					<input name="discordRoleName" defaultValue={currentName} autoComplete="off" />
				</label>
			</>
		);
	const current = picker.roles.find((role) => role.id === selected);
	const unknownCurrent = selected && selected !== CREATE_ROLE && !current;
	return (
		<>
			<label className="wide">
				{text("Discord role", "Discord-Rolle")}
				<select name="discordRoleId" value={selected} onChange={(event) => setSelected(event.target.value)}>
					<option value="">{text("No role", "Keine Rolle")}</option>
					<option value={CREATE_ROLE}>{text("+ Create new role…", "+ Neue Rolle erstellen…")}</option>
					{unknownCurrent && (
						<option value={selected}>
							{selected.startsWith("managed:")
								? text(`Created automatically (${currentName || selected})`, `Wird automatisch erstellt (${currentName || selected})`)
								: text(`Unknown role ${selected}`, `Unbekannte Rolle ${selected}`)}
						</option>
					)}
					{picker.roles.map((role) => (
						<option key={role.id} value={role.id} disabled={!role.assignable}>
							{role.name}
							{role.assignable ? "" : text(" (above the bot)", " (über dem Bot)")}
						</option>
					))}
				</select>
				{picker.error && <small className="form-error">{picker.error}</small>}
				<small className="muted-note">{hint}</small>
			</label>
			{selected === CREATE_ROLE ? (
				<label className="wide">
					{text("Name of the new role", "Name der neuen Rolle")}
					<input name="discordRoleName" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} required autoComplete="off" />
					<small className="muted-note">{text("The role is created on Discord when you save.", "Die Rolle wird beim Speichern auf Discord erstellt.")}</small>
				</label>
			) : (
				<input type="hidden" name="discordRoleName" value={current?.name || (unknownCurrent ? currentName || "" : "")} />
			)}
		</>
	);
}
