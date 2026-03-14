import { SupabaseClient } from '@supabase/supabase-js';

export class StorageManager {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Uploads an image to the 'gambar' bucket.
     * Includes sanitization and proper content-type to prevent 'invalid request' errors on subsequent uploads.
     */
    async uploadImage(file: File): Promise<string> {
        try {
            // Sanitize file name to prevent invalid request errors
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
            const sanitizedExt = fileExt.replace(/[^a-z0-9]/g, '');
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 10000)}.${sanitizedExt}`;
            const filePath = `uploads/${fileName}`;
            
            console.log(`Uploading image to 'gambar' bucket: ${filePath}`);
            
            const { error } = await this.supabase.storage.from('gambar').upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'image/jpeg' // Explicitly set content type
            });
            
            if (error) {
                console.error("Supabase Storage Error:", error);
                if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
                    throw new Error("Koneksi gagal (Fetch Failed). Pastikan bucket 'gambar' sudah dibuat dan memiliki policy publik.");
                }
                throw new Error(error.message);
            }
            
            const { data: { publicUrl } } = this.supabase.storage.from('gambar').getPublicUrl(filePath);
            return publicUrl;
        } catch (err: any) {
            console.error("StorageManager.uploadImage Exception:", err);
            throw err;
        }
    }

    /**
     * Uploads a voice note to the 'voice note' bucket.
     */
    async uploadVoiceNote(blob: Blob, ext: string): Promise<string> {
        try {
            const sanitizedExt = ext.replace(/[^a-z0-9]/g, '');
            const fileName = `vn-${Date.now()}-${Math.floor(Math.random() * 10000)}.${sanitizedExt}`;
            
            const { error } = await this.supabase.storage.from('voice note').upload(fileName, blob, {
                cacheControl: '3600',
                upsert: false,
                contentType: blob.type || (ext === 'mp4' ? 'audio/mp4' : 'audio/webm')
            });
            
            if (error) {
                console.error("Supabase VN Storage Error:", error);
                throw new Error(error.message);
            }
            
            const { data: { publicUrl } } = this.supabase.storage.from('voice note').getPublicUrl(fileName);
            return publicUrl;
        } catch (err: any) {
            console.error("StorageManager.uploadVoiceNote Exception:", err);
            throw err;
        }
    }
}
