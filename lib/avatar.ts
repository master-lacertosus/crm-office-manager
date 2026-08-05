/**
 * Foto profilo — fase placeholder: il file scelto viene ritagliato al
 * centro e ridotto a un quadrato compatto, poi salvato come data URL in
 * locale. Con Supabase Storage cambierà solo la destinazione del upload.
 */

/** Lato dell'avatar generato: nitido anche su schermi 2x per size "lg". */
const AVATAR_SIZE = 192;

/** Peso massimo accettato per il file sorgente (prima del ritaglio). */
export const MAX_AVATAR_FILE_BYTES = 8 * 1024 * 1024;

export class AvatarError extends Error {
  constructor(
    public reason: "not-image" | "too-big" | "decode",
    message: string,
  ) {
    super(message);
  }
}

/** Decodifica rispettando l'orientamento EXIF; fallback su <img>. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* formato non gestito qui: si tenta il percorso <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new AvatarError("decode", "Immagine non leggibile");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Converte il file in un avatar quadrato (data URL JPEG, ~5–15 KB). */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new AvatarError("not-image", "Il file non è un'immagine");
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new AvatarError("too-big", "Immagine troppo pesante");
  }
  const bitmap = await loadBitmap(file);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    if (!w || !h) throw new AvatarError("decode", "Immagine non leggibile");
    const side = Math.min(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarError("decode", "Canvas non disponibile");
    // Fondo bianco: i PNG trasparenti non diventano neri in JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      (w - side) / 2,
      (h - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}
