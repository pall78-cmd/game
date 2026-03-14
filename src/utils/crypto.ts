import CryptoJS from 'crypto-js';

export const CryptoUtils = {
    encrypt: (text: string, key: string) => {
        if (!key) return text;
        try {
            return '[ENC]' + CryptoJS.AES.encrypt(text, key).toString();
        } catch (e) {
            return text;
        }
    },
    decrypt: (text: string, key: string) => {
        if (!text || !text.startsWith('[ENC]')) return text;
        const ciphertext = text.substring(5);
        if (!key) return '🔒 [Pesan Dienkripsi] Masukkan kunci di pengaturan';
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, key);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            return decrypted || '🔒 [Dekripsi Gagal] Kunci salah?';
        } catch (e) {
            return '🔒 [Dekripsi Gagal] Kunci salah?';
        }
    }
};
