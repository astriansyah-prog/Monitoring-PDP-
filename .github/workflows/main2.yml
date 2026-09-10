# Monitoring PDP — DIV SAK

Dashboard monitoring Persediaan Dalam Pengerjaan (PDP) PLN, disusun dari data
DIV PMO (kategori D1–D4, Cluster Proyek 1-9) dan DIV AKT/SAP (tarikan nilai
PDP per unit). File ini adalah HTML/CSS/JS statis biasa — tidak perlu server
backend, bisa langsung dibuka di browser atau di-hosting di GitHub Pages,
Netlify, Vercel, atau folder web apa pun.

## Struktur folder

```
index.html                       halaman utama (buka file ini)
css/style.css                    semua styling
js/vendor/chart.umd.js           library Chart.js (vendored, tidak perlu internet)
js/data-source.js                pengambil + parser data dari Google Sheets (LIVE)
js/app.js                        rendering seluruh dashboard (6 halaman/tab)
data/dashboard_data.snapshot.json snapshot data cadangan (dipakai kalau live fetch gagal)
assets/pln-logo.png               logo PLN untuk header sidebar
```

## Cara kerja pengambilan data (live)

`js/data-source.js` mengambil 8 tab dari Google Sheet secara langsung dari
browser pengguna (bukan dari server Claude), lewat endpoint publik Google:

```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/gviz/tq?tqx=out:csv&sheet=<NAMA_TAB>
```

Alurnya setiap kali halaman dibuka:

1. Cek cache di `localStorage` browser (berlaku 30 menit) — kalau masih segar, pakai itu dulu (supaya tidak membebani Google setiap kali halaman dibuka).
2. Kalau cache basi/belum ada: ambil live dari Google Sheets, parse CSV, hitung ulang semua agregasi (total PDP, kategori D1-D4, cluster, rekonsiliasi SAP, dll — persis logika yang dipakai saat dashboard ini pertama kali dibuat), lalu simpan ke cache.
3. Kalau live fetch gagal (offline, sheet di-private-kan, nama tab berubah, dsb): otomatis coba pakai cache lama; kalau cache juga tidak ada, jatuh ke `data/dashboard_data.snapshot.json` (snapshot per Juni 2026 yang sudah dibundel).

Status sumber data ditampilkan di pojok kiri bawah sidebar (🟢 Data live / 🟡
Cache browser / 🟠 Cache lama / ⚪ Snapshot bawaan), lengkap dengan tombol
**⟳ Refresh** untuk memaksa ambil ulang dari Google Sheets kapan saja.

## Supaya live fetch benar-benar jalan

1. Buka Google Sheet-nya → tombol **Share** (kanan atas) → pastikan akses
   diset **"Anyone with the link" – Viewer**. Endpoint CSV publik di atas
   butuh ini; tanpa itu, browser pengunjung akan mendapat error/redirect
   login dan dashboard otomatis jatuh ke mode snapshot.
2. Nama-nama tab di `CONFIG.SHEETS` (bagian atas `js/data-source.js`) harus
   sama persis dengan nama tab di sheet Anda: `D1`, `D2`, `D3`, `D4`,
   `Cluster Proyek 1-9`, `Biaya Ditangguhkan`, `SAP-DIVAKT`,
   `Rekap Settlement`.
3. Layout kolom setiap tab harus mengikuti template asli (posisi kolom
   dibaca berdasarkan nomor kolom tetap, bukan dicari berdasarkan nama
   header) — kalau Anda menambah/menghapus kolom di tengah tabel, sesuaikan
   juga nomor kolom terkait di `js/data-source.js`.
4. Kalau Anda mengganti ke spreadsheet lain sama sekali, cukup ubah
   `CONFIG.SPREADSHEET_ID` di baris paling atas `js/data-source.js` (ambil
   dari URL sheet Anda, bagian antara `/d/` dan `/edit`).

## Cara pakai / deploy

**Buka langsung secara lokal**: klik dua kali `index.html`. Browser modern
biasanya tetap bisa fetch CSV publik dari `file://`, tapi kalau browser Anda
memblokir itu (kebijakan CORS lokal), dashboard otomatis pakai snapshot —
tidak akan blank/error.

**GitHub Pages** (paling praktis untuk dipakai jangka panjang):
1. Buat repo baru di GitHub, upload seluruh isi folder ini (bukan folder
   itu sendiri — file `index.html` harus ada persis di root repo, atau di
   root folder `/docs` kalau Anda pilih opsi itu).
2. Settings → Pages → Source: pilih branch (`main`) dan folder (`/root` atau
   `/docs`) tempat `index.html` berada → Save.
3. Tunggu 1-2 menit, GitHub akan memberi URL publik
   (`https://<username>.github.io/<repo>/`).
4. Setiap kali sheet sumber di-update, tinggal buka ulang halaman (atau klik
   **⟳ Refresh**) — tidak perlu upload ulang apa pun.

**Netlify / Vercel / hosting statis lain**: drag-and-drop folder ini, sama
saja — tidak ada langkah build.

## Memperbarui snapshot cadangan

Snapshot di `data/dashboard_data.snapshot.json` adalah jaring pengaman kalau
live fetch gagal total (misalnya sheet-nya di-private-kan). Snapshot ini
tidak auto-update; kalau ingin menyegarkannya sesekali, generate ulang dari
sheet yang sama (skrip Python `build_data.py` yang dipakai untuk membuat
dashboard ini tersedia terpisah bila diperlukan) lalu timpa file JSON
tersebut. Ini opsional — selama sheet tetap bisa diakses publik, live fetch
akan selalu dipakai duluan.

## Catatan kualitas data

- Semua nilai Rupiah di sheet ini adalah bilangan bulat (tanpa desimal),
  jadi parser mengasumsikan setiap "." atau "," pada sel angka adalah
  pemisah ribuan, bukan koma desimal.
- Kolom "Progress Fisik" bulanan (Sep 2025–Mei 2026) di tab D3 berisi sisa
  formula/nilai yang rusak di sheet sumber, sehingga dashboard hanya
  menampilkan snapshot Juni 2026 (bersih) untuk metrik ini, dalam bentuk
  histogram distribusi — bukan tren bulanan yang menyesatkan.
- Rekonsiliasi nilai PDP (halaman "PMO vs SAP") membandingkan total dari
  kategorisasi D1-D4 (DIV PMO) terhadap tarikan SAP untuk entitas ber-flag
  UIP (DIV AKT) — bukan seluruh entitas SAP (yang juga mencakup UIT/UID/UIW
  dan Kantor Pusat, ditampilkan terpisah sebagai konteks).
