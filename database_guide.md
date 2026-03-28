# Database Guide  
Panduan Pengelolaan Database Aplikasi Perpustakaan Sekolah

Dokumen ini ditujukan untuk **operator sekolah / admin sistem** agar memahami cara melihat, mengelola, dan mengisi data database aplikasi perpustakaan dengan aman.

Aplikasi ini menggunakan **SQLite + Prisma ORM** sebagai sistem database.

---

## 📁 Lokasi Database
File database berada di:

```
backend/prisma/dev.db
```

⚠️ **PENTING**
- Jangan menghapus file `dev.db` kecuali benar-benar ingin reset data
- Selalu backup file ini sebelum melakukan perubahan besar

---

## 1️⃣ Cara Paling Aman (TANPA TERMINAL)
### Menggunakan DB Browser for SQLite  
**(Direkomendasikan untuk operator non-teknis / kondisi genting)**

### Aplikasi
- **DB Browser for SQLite**
- Download & install sesuai OS (Windows / Mac / Linux)

### Langkah Akses
1. Buka aplikasi **DB Browser for SQLite**
2. Klik **Open Database**
3. Pilih file:
   ```
   backend/prisma/dev.db
   ```
4. Buka tab **Browse Data**
5. Pilih tabel yang ingin dilihat atau diedit, seperti:
   - `User`
   - `Member`
   - `Book`
   - `Class`
   - `Loan`
6. Lakukan perubahan data jika diperlukan
7. Klik **Write Changes** agar perubahan tersimpan

### Catatan Penting
- Jangan menghapus data sembarangan
- Perubahan langsung berdampak ke aplikasi
- Gunakan hanya untuk edit data darurat

---

## 2️⃣ Cara Visual & Modern (GUI)
### Menggunakan Prisma Studio

Prisma Studio adalah tampilan database berbasis browser yang lebih modern dan nyaman.

### Menjalankan Prisma Studio
Perintah:
```bash
npx prisma studio
```

### Akses
Buka browser dan kunjungi:
```
http://localhost:5555
```

### Kegunaan
- Menambah data User, Anggota, Buku, Kelas
- Mengedit atau menghapus data
- Mengecek apakah data benar-benar tersimpan
- Sangat cocok untuk **development & testing**

💡 **TIP:**  
Prisma Studio adalah alat terbaik untuk memastikan database berjalan normal.

---

## 3️⃣ Mengisi Data Awal (Seeding Database)
Saat aplikasi pertama kali diinstall, database bisa kosong.  
Untuk itu tersedia fitur **seeding**.

### File Seeding
```
backend/prisma/seed.ts
```

### Menjalankan Seeding
```bash
npm run db:seed
```

### Fungsi Seeding
- Mengisi data awal (default)
- Menggunakan metode **upsert**
  - Jika data sudah ada → tidak dibuat ulang
  - Jika belum ada → dibuat baru

Aman dijalankan lebih dari satu kali.

---

## 4️⃣ Akses Database Melalui Kode (Developer)
Jika ingin menambah fitur atau melakukan pengembangan lanjutan, database diakses melalui **Prisma Client**.

### Contoh Penggunaan

#### Mengambil Semua Buku
```ts
const books = await prisma.book.findMany();
```

#### Mencari User Berdasarkan Email
```ts
const user = await prisma.user.findUnique({
  where: { email: 'admin@perpus.com' }
});
```

#### Menambah User Baru
```ts
await prisma.user.create({
  data: {
    name: 'Nama Baru',
    email: 'baru@email.com',
    password: 'hashed_password',
    role: 'pustakawan'
  }
});
```

---

## 5️⃣ Update Struktur Database (Migration)
Jika ada perubahan struktur database (misalnya menambah kolom atau tabel):

### Langkah-langkah
1. Edit file:
   ```
   backend/prisma/schema.prisma
   ```
2. Jalankan perintah:
   ```bash
   npx prisma migrate dev --name nama_perubahan
   ```
3. Prisma akan:
   - Memperbarui database
   - Mengupdate Prisma Client secara otomatis

⚠️ **PERINGATAN**
- Migration sebaiknya dilakukan oleh developer
- Selalu backup database sebelum migration

---

## 🔐 Tips Keamanan & Best Practice
- Backup file `dev.db` secara berkala
- Jangan edit database langsung tanpa alasan jelas
- Gunakan Prisma Studio untuk pengecekan data
- Gunakan import Excel dari aplikasi untuk input data massal

---

## 📌 Ringkasan
| Kebutuhan | Cara |
|---------|------|
| Edit data cepat | DB Browser for SQLite |
| Cek & kelola data visual | Prisma Studio |
| Isi data awal | Seeding |
| Pengembangan fitur | Prisma Client |
| Ubah struktur database | Migration |

---

Dokumen ini dibuat untuk memastikan aplikasi **mudah dirawat, aman, dan profesional** saat digunakan di lingkungan sekolah.
