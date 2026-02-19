import { GameDeckState } from '../types';

export type Intensity = 'LIGHT' | 'DEEP' | 'CHAOS';
const CHANCE_WILDCARD = 0.15;

const LIGHT_TRUTHS = [
    "Siapa selebriti crush pertamamu?", "Makanan aneh yang kamu suka?", "Kapan terakhir ngompol?", "Kartun masa kecil favorit?", "Uang 1M buat beli apa?", "Siapa yang paling typo?", "Barang termurah yang kamu pakai?", "Hal konyol yang kamu cari di Google?", "Ingin jadi hewan apa?", "Pernah pura-pura sakit?", "Lagu yang bikin malu?", "Karakter fiksi idaman?", "Nama panggilan paling aneh?", "Bakat terpendam gak berguna?", "Hal paling memalukan di umum?", "Guru paling dibenci?", "Naksir pacar teman?", "Kebohongan terakhir?", "Orang terakhir yang di-stalk?", "Password wifi rumah?", "Kentut di lift lalu tuduh orang?", "Mimpi teraneh?", "Pernah nyuri sesuatu?", "Siapa yang mau jadi asistenmu?", "Chat terakhir yang dihapus?", "Baju terbalik tanpa sadar?", "Ketakutan irasional?", "Kapan terakhir mandi?"
];
const LIGHT_DARES = [
    "Kirim stiker teraneh.", "Ganti nama admin jadi 'Paduka Raja'.", "VN lagu nasional pakai 'O'.", "Foto lantai sekarang.", "Selfie ekspresi jelek.", "Ketik pakai hidung: 'Aku Oracle'.", "Screenshot wallpaper HP.", "Foto profil monyet 10 menit.", "Prank chat teman 'Aku hamil'.", "Spam stiker 5x.", "VN suara kambing.", "Foto isi kulkas.", "Status WA 'Butuh Perhatian'.", "Foto jari kaki.", "Chat ortu 'I love you'.", "Selfie zoom hidung.", "VN ketawa mak lampir.", "Sebut 3 hewan bahasa Inggris cepat.", "Tahan nafas 20 detik.", "Selfie filter alay.", "VN 'Aku cantik' 3x.", "Bio WA 'Open BO' 2 menit.", "Chat teman 'Pinjam Seratus'.", "Foto barang di sebelah kiri.", "VN nyanyi lagu nasional.", "Kirim emoji favorit 10x.", "Tulis nama pakai tangan kiri.", "Foto langit-langit kamar."
];
const LIGHT_WILDCARDS = [
    "Tunjuk siapa saja buat jawab Truth.", "Pilih member buat VN nyanyi.", "Truth buat kamu atau Dare buat bawahmu.", "Semua kirim emoji buat kamu.", "Makan cabai atau push up 20x.", "Tukar foto profil 1 jam.", "Duel stiker, yang aneh menang.", "Batu gunting kertas sama admin.", "Pilih 2 orang duel stiker.", "Satu pertanyaan buat semua.", "Pilih Raja 10 menit.", "Semua wajib VN Selamat Pagi.", "Tunjuk orang buat selfie.", "Semua ganti bio WA.", "Kamu bebas giliran!", "Pilih teman buat dare bareng.", "Reverse! Balikin pertanyaan.", "Skip giliran lempar ke bawah.", "Semua puji foto profilmu.", "Pilih member baca puisi VN.", "Tunjuk orang cerita lelucon.", "Wajib Truth DAN Dare.", "Semua rate lagu pilihanmu.", "Semua kirim foto batre HP.", "Tunjuk yang paling sering online.", "Pilih pasangan game 3 putaran.", "Semua kirim 1 kata jadi kalimat.", "Tunjuk orang SS chat terakhir."
];

const DEEP_TRUTHS = [
    "Kapan terakhir menangis?", "Penyesalan terbesar tahun ini?", "Siapa yang paling dirindukan?", "Insecure bagian fisik mana?", "Pernah cinta tak berbalas?", "Ketakutan masa depan?", "Momen yang ingin diubah?", "Pernah merasa tak dianggap?", "Kebohongan ke ortu?", "Siapa yang paling mirip kamu?", "Mimpi buruk jadi nyata?", "Pernah doain teman putus?", "Hal sulit dimaafkan?", "Kapan merasa paling sepi?", "Pesan terakhir buat grup?", "Sifat toxic yang kamu punya?", "Sengaja nyakitin orang?", "Kenangan indah yang sakit?", "Orang yang berjasa tapi dicuekin?", "Bahagia dengan hidup sekarang?", "Trauma masa kecil?", "Ingin minta maaf ke siapa?", "Arti cinta buat kamu?", "Pernah mau kabur dari rumah?", "Kenapa hilang percaya orang?", "Siapa yang sering bikin kecewa?", "Pencapaian paling bangga?", "Hal yang tertahan di hati?"
];
const DEEP_DARES = [
    "Chat mantan 'Aku kangen'.", "Ceritakan rahasia terdalam.", "VN terima kasih ke ortu.", "Tulis surat buat masa lalu.", "Foto masa kecil memalukan.", "Chat sahabat 'Makasih ya'.", "Hapus 1 kontak toxic.", "Post status galau hide ortu.", "VN nangis buatan.", "Cerita detail patah hati.", "Kirim foto orang dibenci.", "Sebut 3 sifat jelekmu.", "Chat ortu 'Maafin aku'.", "Lagu yang ngingetin mantan.", "Cerita hari terburuk.", "SS chat terakhir sama crush.", "Puisi sedih via VN.", "Ubah 1 hal dari fisikmu.", "Block 1 orang random.", "Unfollow akun toxic.", "Momen ngerasa gak berharga.", "Sebut nama orang yang dighosting.", "Akui kesalahan di grup.", "Foto selfie sedih.", "Sebut 5 hal disyukuri.", "Peluk guling kirim foto.", "Cerita cinta pertama.", "Janji yang diingkari."
];
const DEEP_WILDCARDS = [
    "Semua jawab: Apa arti bahagia?", "Cerita aib atau puji musuh.", "Jawab member termuda atau selfie.", "Ungkap rahasia atau jujur rasa.", "Puji 1 orang di grup.", "Semua cerita ketakutan.", "Pilih member cerita spiritual.", "Tunjuk orang jujur soal crush.", "Semua kirim kenangan indah.", "Pilih member motivasi VN.", "Semua sebut goal tahun ini.", "Dunia kiamat mau ngapain?", "Lagu yang ubah hidup.", "Deskripsikan member 1 kata.", "Semua akuin 1 bohong.", "Tunjuk orang cerita mimpi.", "Semua setor foto langit.", "Member curhat 1 menit VN.", "Satu hal yang bikin bersyukur.", "Momen paling awkward.", "Cinta atau karir? Jelasin.", "Member cerita hewan kesayangan.", "Definisi sukses?", "Member cerita film favorit.", "Siapa role model hidupmu?", "Pengalaman hampir mati.", "Nasihat terbaik?", "Kebiasaan buruk?"
];

const CHAOS_TRUTHS = [
    "Bagian tubuh pasangan favorit?", "Fantasi terliar?", "Kapan terakhir turn on?", "Posisi favorit?", "Hal nakal di tempat umum?", "Ukuran atau teknik?", "Fetish teraneh?", "Suara yang disukai saat intim?", "Tempat berisiko yang dicoba?", "Warna pakaian dalam?", "Pernah kirim nudes?", "Foreplay atau langsung?", "Ilfeel saat ciuman karena?", "Imajinasi orang lain?", "Lampu nyala atau mati?", "Bagian tubuh paling sensitif?", "Pernah ketahuan solo?", "Tontonan dewasa favorit?", "Rekor terlama?", "Kasar atau lembut?", "Pernah pakai toys?", "Dirty talk favorit?", "Atas atau bawah?", "Main di luar ruangan?", "Pengalaman first time?", "Berbulu atau mulus?", "Pernah rekam aktivitas?", "Hal gila demi kepuasan?"
];
const CHAOS_DARES = [
    "Foto leher View Once.", "VN kata-kata nakal.", "Eja nama pakai lidah video.", "Gigit bibir seksi pap.", "VN suara ciuman.", "Chat pasangan 'Aku gak pake baju'.", "Foto lidah ahegao.", "VN panggil Daddy/Mommy.", "Status WA 'Lagi pengen'.", "Foto tangan remas bantal.", "Desah nama member VN.", "Foto paha aman menggoda.", "Foto bibir close up.", "Jilat jari pap.", "VN suara nafas berat.", "Foto perut/abs.", "Chat random 'Aku keras'.", "Foto bayangan tubuh.", "VN ASMR makan es krim.", "Foto kaki (feet).", "Video goyang pinggul.", "Foto bekas gigitan.", "VN 'Sentuh aku'.", "Foto kasur berantakan.", "Pakai lipstik berantakan pap.", "VN suara minum menggoda.", "Foto punggung.", "Pap outfit tidur."
];
const CHAOS_WILDCARDS = [
    "VN desah atau foto bibir.", "Cerita mimpi basah atau pap paha.", "Pap outfit tidur atau jujur lampu.", "Dominant atau Submissive?", "Satu kata soal nafsu.", "Pilih member desah VN.", "Cerita ciuman pertama.", "Spit or swallow?", "Pilih orang kirim foto leher.", "Turn on terbesar?", "Awkward saat intim?", "Pagi atau malam buat 'itu'?", "Member VN suara berat.", "Pernah FWB?", "SS galeri tersembunyi.", "Suka oral?", "Sebut ukuran ideal.", "Pernah sexting?", "Lokasi main impian.", "Suka lingerie warna apa?", "Pilih member kirim foto tangan.", "Pernah one night stand?", "Rate skill kissing (1-10).", "Zona erotis favorit?", "Tipe tubuh ideal?", "Mandi bareng atau sendiri?", "VN 'I want you'.", "Mainan atau natural?"
];

const createFreshDeck = (): GameDeckState => ({
    light: { truths: [...LIGHT_TRUTHS], dares: [...LIGHT_DARES], wildcards: [...LIGHT_WILDCARDS] },
    deep: { truths: [...DEEP_TRUTHS], dares: [...DEEP_DARES], wildcards: [...DEEP_WILDCARDS] },
    chaos: { truths: [...CHAOS_TRUTHS], dares: [...CHAOS_DARES], wildcards: [...CHAOS_WILDCARDS] }
});

export const initDeck = (): GameDeckState => {
    const saved = localStorage.getItem('oracle_deck_v17_9');
    return saved ? JSON.parse(saved) : createFreshDeck();
};

export const saveDeck = (deck: GameDeckState) => localStorage.setItem('oracle_deck_v17_9', JSON.stringify(deck));
export const resetDeck = (): GameDeckState => { localStorage.removeItem('oracle_deck_v17_9'); return createFreshDeck(); };

export const drawCard = (currentDeck: GameDeckState, intensity: Intensity): { content: string, newDeck: GameDeckState } => {
    const key = intensity.toLowerCase() as keyof GameDeckState;
    const roll = Math.random();
    let type: 'truths' | 'dares' | 'wildcards';
    let prefix = "";

    if (roll < CHANCE_WILDCARD) { type = 'wildcards'; prefix = "WILD: "; }
    else if (roll < (CHANCE_WILDCARD + (1 - CHANCE_WILDCARD) / 2)) { type = 'truths'; prefix = "TRUTH: "; }
    else { type = 'dares'; prefix = "DARE: "; }

    let pool = currentDeck[key][type];
    if (pool.length === 0) pool = createFreshDeck()[key][type];

    const idx = Math.floor(Math.random() * pool.length);
    let card = pool[idx].replace(/^(TRUTH:|DARE:|WILD:|CHOICE:)\s*/i, "");
    if (type === 'wildcards' && card.includes("ATAU")) prefix = "CHOICE: ";

    const newPool = [...pool]; newPool.splice(idx, 1);
    const newDeck = { ...currentDeck, [key]: { ...currentDeck[key], [type]: newPool } };
    saveDeck(newDeck);
    return { content: prefix + card, newDeck };
};