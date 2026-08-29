import type { Album, AlbumDetail } from "../types";
import { asError } from "./client";

export async function listAlbums(): Promise<Album[]> {
  const res = await fetch("/api/albums");
  if (!res.ok) return asError(res);
  return ((await res.json()) as { albums: Album[] }).albums;
}

export async function getAlbum(id: string): Promise<AlbumDetail> {
  const res = await fetch(`/api/albums/${id}`);
  if (!res.ok) return asError(res);
  return ((await res.json()) as { album: AlbumDetail }).album;
}

export async function createAlbum(
  name: string,
): Promise<{ id: string; name: string; createdAt: number }> {
  const res = await fetch("/api/albums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return asError(res);
  return ((await res.json()) as { album: { id: string; name: string; createdAt: number } })
    .album;
}

export async function renameAlbum(
  id: string,
  name: string,
): Promise<AlbumDetail> {
  const res = await fetch(`/api/albums/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return asError(res);
  return ((await res.json()) as { album: AlbumDetail }).album;
}

export async function deleteAlbum(id: string): Promise<void> {
  const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return asError(res);
}

export async function addTracksToAlbum(
  id: string,
  trackIds: string[],
): Promise<{ added: number; album: AlbumDetail }> {
  const res = await fetch(`/api/albums/${id}/tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackIds }),
  });
  if (!res.ok) return asError(res);
  return (await res.json()) as { added: number; album: AlbumDetail };
}

export async function removeTrackFromAlbum(
  id: string,
  trackId: string,
): Promise<AlbumDetail> {
  const res = await fetch(`/api/albums/${id}/tracks/${trackId}`, {
    method: "DELETE",
  });
  if (!res.ok) return asError(res);
  return ((await res.json()) as { album: AlbumDetail }).album;
}

export async function reorderAlbum(
  id: string,
  trackIds: string[],
): Promise<AlbumDetail> {
  const res = await fetch(`/api/albums/${id}/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackIds }),
  });
  if (!res.ok) return asError(res);
  return ((await res.json()) as { album: AlbumDetail }).album;
}
