const express = require('express');
const mysql = require('mysql2');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Koneksi Database (Kredensial diambil dari Azure Environment Variables)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// Koneksi Blob Storage
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

// Endpoint untuk submit tugas
app.post('/submit-task', upload.single('file_tugas'), async (req, res) => {
    const { nim, name, class_name, course } = req.body;
    const blobName = `${nim}_${req.file.originalname}`;

    try {
        // Upload ke Azure Blob Storage (Pastikan nama container ini sesuai dengan di Azure Portal)
        const containerClient = blobServiceClient.getContainerClient('tugas-praktikum-050');
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(req.file.buffer);
        const fileUrl = blockBlobClient.url;

        // Simpan Metadata ke MySQL
        const sql = "INSERT INTO submissions (nim, name, class, course, file_url) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [nim, name, class_name, course, fileUrl], (err) => {
            if (err) return res.status(500).send("Gagal update DB: " + err);
            
            // Tampilan sukses Dark Mode
            res.send(`
                <div style="background-color: #121212; color: #00ff88; text-align: center; padding: 50px; font-family: sans-serif; height: 100vh;">
                    <h2>Tugas Berhasil Dikirim!</h2>
                    <a href="/" style="color: #ffffff; text-decoration: none; border: 1px solid #555; padding: 10px 20px; border-radius: 5px; display: inline-block; margin-top: 20px;">Kembali ke Form</a>
                </div>
            `);
        });
    } catch (error) {
        res.status(500).send("Error saat upload ke Storage: " + error.message);
    }
});

// Endpoint untuk melihat daftar tugas (Tampilan Admin Dark Mode)
app.get('/task-list', (req, res) => {
    const sql = "SELECT * FROM submissions ORDER BY submitted_at DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        
        let rows = results.map(r => `
            <tr>
                <td>${r.nim}</td>
                <td>${r.name}</td>
                <td>${r.class}</td>
                <td>${r.course}</td>
                <td><a href="${r.file_url}" target="_blank" class="link-file">Buka File</a></td>
                <td><span class="badge ${r.status === 'Submitted' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
                <td>${new Date(r.submitted_at).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Daftar Tugas | TRPL Cloud</title>
                <style>
                    body { background-color: #121212; color: #e0e0e0; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 2rem; }
                    .container { background-color: #1e1e1e; border-radius: 8px; padding: 2rem; max-width: 1000px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-top: 4px solid #00ff88; }
                    h2 { color: #00ff88; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background-color: #2c2c2c; color: #00ff88; padding: 12px; text-align: left; border-bottom: 2px solid #00ff88; }
                    td { padding: 12px; border-bottom: 1px solid #333; }
                    .link-file { color: #00ff88; text-decoration: none; font-weight: bold; }
                    .link-file:hover { text-decoration: underline; color: #fff; }
                    .badge { padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
                    .badge-success { background-color: #00ff88; color: #121212; }
                    .badge-warning { background-color: #ffaa00; color: #121212; }
                    .back-btn { color: #fff; text-decoration: none; display: inline-block; margin-bottom: 20px; border: 1px solid #555; padding: 8px 15px; border-radius: 4px; transition: 0.3s; }
                    .back-btn:hover { background-color: #333; border-color: #00ff88; }
                </style>
            </head>
            <body>
                <div class="container">
                    <a href="/" class="back-btn">⬅ Kembali ke Form</a>
                    <h2>Database Pengumpulan Tugas</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>NIM</th><th>Nama</th><th>Kelas</th><th>Mata Kuliah</th><th>File</th><th>Status</th><th>Waktu</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </body>
            </html>
        `);
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Aplikasi TRPL running cuy");
});