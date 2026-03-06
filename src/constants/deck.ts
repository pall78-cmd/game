export interface DeckCategory {
    truth: string[];
    dare: string[];
    wildcard: string[];
    wildcardChance: number;
}

export interface GameDeck {
    light: DeckCategory;
    deep: DeckCategory;
    chaos: DeckCategory;
}

export const GAME_DECK: GameDeck = {
    light: {
        truth: [
            "Apa hal kecil yang paling kamu kangenin dari aku?",
            "Kalau kita bisa teleportasi sekarang, kita mau pergi ke mana?",
            "Apa kebiasaan anehku yang diam-diam kamu suka?",
            "Apa momen paling lucu yang pernah kita alami saat video call?",
            "Kalau kita tinggal bareng, siapa yang bakal lebih sering masak?",
            "Apa lagu yang langsung bikin kamu inget aku?",
            "Apa hal pertama yang bakal kamu lakuin pas kita ketemu nanti?",
            "Apa emoji yang paling menggambarkan hubungan kita?",
            "Ceritain satu hal yang bikin kamu senyum hari ini!",
            "Apa panggilan kesayangan yang paling kamu suka dari aku?",
            "Apa foto favoritmu dari kita berdua?",
            "Apa hal yang paling bikin kamu ketawa pas ngobrol sama aku?",
            "Kalo aku jadi makanan, aku bakal jadi makanan apa?",
            "Apa hal paling random yang pernah kamu pikirin tentang aku?",
            "Apa kebiasaan pagimu yang pengen kamu lakuin bareng aku?"
        ],
        dare: [
            "Kirim VN nyanyiin reff lagu favorit kita!",
            "Kirim foto selfie dengan ekspresi paling konyol sekarang juga.",
            "Tulis pesan manis sepanjang 3 kalimat dan kirim ke aku.",
            "Ganti nama kontakku di HP-mu jadi sesuatu yang lucu selama 24 jam.",
            "Kirim foto barang di sekitarmu yang warnanya sama dengan bajuku sekarang.",
            "Kasih aku 3 pujian berturut-turut pakai VN.",
            "Kirim stiker paling aneh yang kamu punya di galeri.",
            "Lakukan pose saranghae di depan kamera/kirim fotonya.",
            "Kirim foto makanan/minuman terakhir yang kamu konsumsi.",
            "Ceritain satu lelucon garing pakai VN.",
            "Kirim foto langit di tempatmu sekarang.",
            "Kirim VN bilang 'Aku sayang kamu' dengan 3 nada berbeda.",
            "Tirukan suara hewan favoritmu lewat VN.",
            "Kirim foto outfit yang lagi kamu pake sekarang.",
            "Pilih satu emoji dan jadikan itu balasan untuk 5 pesanku berikutnya."
        ],
        wildcard: [
            "Bebas dari satu tantangan hari ini!",
            "Kamu berhak minta aku ngelakuin satu hal manis buat kamu.",
            "Tukar giliran! Aku yang harus jawab pertanyaan Light dari kamu.",
            "Pilih satu foto dari galeriku untuk kujadikan profil picture selama 1 jam.",
            "Kamu boleh minta aku kirim VN nyanyiin lagu pilihanmu."
        ],
        wildcardChance: 0.15
    },
    deep: {
        truth: [
            "Kapan momen kamu ngerasa paling bersyukur punya aku?",
            "Apa ketakutan terbesarmu soal hubungan jarak jauh kita?",
            "Apa hal yang pengen banget kamu perbaiki dari hubungan kita?",
            "Ceritain momen di mana kamu ngerasa paling disayang sama aku.",
            "Apa satu hal yang belum pernah kamu ceritain ke aku karena takut aku marah?",
            "Menurutmu, apa tantangan terbesar kita ke depannya?",
            "Apa hal yang paling bikin kamu ngerasa 'klik' sama aku di awal kita kenal?",
            "Kalau kita lagi berantem, apa hal yang paling kamu butuhin dari aku?",
            "Apa mimpi terbesarmu buat masa depan kita berdua?",
            "Apa hal yang paling bikin kamu bangga sama dirimu sendiri belakangan ini?",
            "Apa pengorbanan terbesar yang rela kamu lakuin buat hubungan ini?",
            "Kapan kamu ngerasa paling jauh/kesepian dari aku, dan gimana cara ngatasinnya?",
            "Apa sifatku yang paling bikin kamu ngerasa aman?",
            "Apa hal yang paling kamu sesali pernah kamu ucapkan ke aku?",
            "Gimana caramu meyakinkan diri sendiri pas lagi ragu sama hubungan kita?"
        ],
        dare: [
            "Tulis paragraf panjang tentang kenapa kamu milih aku, dan kirim sekarang.",
            "Kirim VN ceritain hal yang paling kamu syukuri hari ini dengan nada lembut.",
            "Kirim foto lama kita/kamu yang paling punya banyak kenangan, ceritain alasannya.",
            "Jujur tentang satu hal yang bikin kamu cemburu tapi gengsi buat bilang.",
            "Telepon aku sekarang juga cuma buat bilang 'I love you'.",
            "Kirim screenshot chat pertama kita (kalau masih ada) atau chat paling berkesan.",
            "Ceritain satu hal yang bikin kamu insecure, biar aku bisa yakinin kamu.",
            "Kirim VN doa atau harapan baikmu buat hubungan kita.",
            "Tulis 5 hal yang bikin aku spesial di matamu.",
            "Kirim foto mata kamu dari jarak dekat.",
            "Ceritakan satu trauma masa lalumu yang bikin kamu jadi orang yang sekarang.",
            "Kirim VN minta maaf buat satu kesalahan yang mungkin belum pernah kamu bahas.",
            "Tulis surat cinta singkat dan fotoin tulisan tanganmu.",
            "Ceritain momen pas kamu sadar kamu bener-bener jatuh cinta sama aku.",
            "Kirim lagu yang liriknya paling pas buat gambarin perasaanmu ke aku sekarang."
        ],
        wildcard: [
            "Deep Talk Time: Kamu boleh tanya satu pertanyaan apa aja, dan aku harus jawab jujur 100%.",
            "Kamu berhak minta aku ceritain satu rahasia terdalamku.",
            "Kita berdua harus saling kirim VN apresiasi selama 1 menit tanpa putus.",
            "Kamu boleh minta aku jujur tentang satu hal yang bikin aku ragu.",
            "Skip satu pertanyaan Deep kalau kamu ngerasa belum siap jawab."
        ],
        wildcardChance: 0.10
    },
    chaos: {
        truth: [
            "Apa bagian tubuhku yang paling bikin kamu bergairah walau cuma lihat di foto?",
            "Kapan terakhir kali kamu mikirin aku pas lagi 'sendiri'?",
            "Apa fantasi terliarmu tentang kita pas ketemu nanti?",
            "Apa pakaian (atau ketiadaan pakaian) yang paling pengen kamu lihat aku pakai?",
            "Apa hal paling nakal yang pengen kamu lakuin ke aku pas video call?",
            "Suara/desahan seperti apa dari aku yang paling bikin kamu merinding?",
            "Apa chat paling kotor/spicy yang pernah kita obrolin yang bikin kamu sange?",
            "Kalau kita lagi di satu kasur sekarang, apa yang bakal kamu lakuin pertama kali?",
            "Apa hal kinky yang pengen banget kamu coba sama aku?",
            "Bagian tubuh mana dari kamu yang paling pengen aku sentuh/cium duluan?",
            "Pernahkah kamu berfantasi tentang aku pas lagi di tempat umum?",
            "Apa 'turn on' terbesarmu saat kita lagi LDR-an?",
            "Gimana caramu 'menyelesaikan' diri sendiri pas lagi kangen banget sama aku?",
            "Apa posisi seks yang paling pengen kamu coba pas kita ketemu?",
            "Apa hal paling berani yang pernah kamu lakuin buat godain aku lewat chat?"
        ],
        dare: [
            "Kirim VN desahan pelan atau panggil namaku dengan nada paling menggoda.",
            "Kirim foto (View Once) bagian tubuhmu yang paling seksi menurutmu.",
            "Buka satu kancing baju/resleting dan kirim fotonya sekarang.",
            "Deskripsiin secara detail (lewat teks/VN) gimana cara kamu mau 'main' sama aku malam ini.",
            "Kirim foto kamu gigit bibir bawah dengan tatapan nakal.",
            "Pakai pakaian dalam favoritmu (atau tanpa pakaian dalam) dan kasih tau aku detailnya.",
            "Kirim VN ceritain fantasi basah terakhirmu tentang aku.",
            "Lakukan sesuatu yang bikin kamu 'turn on' selama 1 menit sambil chat aku.",
            "Kirim foto leher atau tulang selangkamu dari jarak dekat.",
            "Kasih aku instruksi nakal buat aku lakuin sekarang juga.",
            "Kirim VN dirty talk paling liar yang bisa kamu pikirin selama 30 detik.",
            "Tunjukkan (lewat foto/video VO) mainan seks atau benda yang sering kamu pakai.",
            "Kirim foto tanganmu seolah-olah lagi nyentuh aku.",
            "Ceritain detail apa yang bakal kamu lakuin ke aku kalau aku lagi terikat di kasur.",
            "Kirim pesan teks paling nakal yang bikin aku langsung pengen ketemu."
        ],
        wildcard: [
            "Kamu pegang kendali: Suruh aku lakuin satu hal nakal (lewat VN/Foto/Video VO) sekarang juga.",
            "Free Pass: Kamu boleh minta foto View Once apa aja dari aku.",
            "Roleplay Time: Kita berdua harus roleplay nakal selama 10 menit ke depan.",
            "Kamu boleh minta aku kirim VN mendesah sebut namamu.",
            "Tukar giliran! Aku yang harus ngelakuin dare Chaos pilihanmu."
        ],
        wildcardChance: 0.10
    }
};
