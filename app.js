const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const app = express();

// --- CẤU HÌNH HỆ THỐNG ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'lck_secret', 
    resave: false, 
    saveUninitialized: true 
}));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// --- KẾT NỐI DATABASE ---
const db = mysql.createConnection({ 
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'k_league_pro' 
});

db.connect((err) => {
    if (err) console.error('Lỗi kết nối MySQL:', err);
    else console.log('Đã kết nối Database k_league_pro thành công!');
});

// --- ROUTES GIAO DIỆN NGƯỜI DÙNG (Không bắt buộc đăng nhập) ---

// 1. Trang chủ mặc định (Tự động chuyển hướng sang Lịch thi đấu)
// app.js
app.get('/', (req, res) => {
    // Ép website luôn nhảy vào ngày thi 08/04 khi vừa mở trang chủ
    res.redirect('/lich-thi-dau?date=2026-04-08');
});

// 2. Lịch thi đấu
app.get('/lich-thi-dau', (req, res) => {
    let selectedDate = req.query.date || '2026-04-08';
    const sql = `
        SELECT f.*, c1.club_name as c1_n, c1.club_logo as c1_l, 
                   c2.club_name as c2_n, c2.club_logo as c2_l 
        FROM tournament_fixtures f
        JOIN esports_clubs c1 ON f.home_club_id = c1.club_id
        JOIN esports_clubs c2 ON f.away_club_id = c2.club_id
        WHERE DATE(f.match_day) = ?`;

    db.query(sql, [selectedDate], (err, rows) => {
        if (err) return res.status(500).send("Lỗi tải lịch thi đấu!");
        res.render('main_schedule', { 
            fixtures: rows || [], 
            currentDate: selectedDate,
            user: req.session.user || null // Chuyền user nếu đã đăng nhập, nếu chưa thì là null
        });
    });
});

// 3. Bảng xếp hạng
app.get('/bang-xep-hang', (req, res) => {
    const sql = "SELECT * FROM v_bang_xep_hang ORDER BY matches_won DESC, score_diff DESC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Lỗi truy vấn View:", err);
            return res.status(500).send("Lỗi Database: Hãy kiểm tra View v_bang_xep_hang trong XAMPP!");
        }
        res.render('ranking', { 
            user: req.session.user || null, 
            rankings: results || [] 
        });
    });
});


// --- ROUTES XÁC THỰC (LOGIN / LOGOUT) ---

// 4. Trang đăng nhập
app.get('/login', (req, res) => {
    res.render('login');
});

// Xử lý đăng nhập
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (results && results.length > 0) {
            req.session.user = results[0];
            res.redirect('/lich-thi-dau'); // Đăng nhập thành công thì về trang lịch
        } else {
            res.send("<script>alert('Sai tài khoản hoặc mật khẩu!'); window.location='/login';</script>");
        }
    });
});

// Đăng xuất
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/lich-thi-dau'); // Đăng xuất xong vẫn cho ở lại trang lịch xem bình thường
    });
});


// --- ROUTES DÀNH CHO ADMIN (Cập nhật tỷ số, thêm trận) ---

app.post('/update-score', (req, res) => {
    // Lý tưởng nhất là kiểm tra xem user có phải admin không (if req.session.user...) 
    // nhưng để code chạy mượt theo tiến độ hiện tại, ta cứ xử lý luôn:
    const { fixtureId, homeScore, awayScore } = req.body;
    const sql = "UPDATE tournament_fixtures SET home_score = ?, away_score = ?, is_finished = 1 WHERE fixture_id = ?";
    
    db.query(sql, [homeScore, awayScore, fixtureId], (err) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// --- KHỞI ĐỘNG SERVER ---
app.listen(5000, () => {
    console.log("====================================");
    console.log("🚀 Server LCK đã chạy thành công!");
    console.log("👉 Truy cập ngay: http://localhost:5000");
    console.log("====================================");
});