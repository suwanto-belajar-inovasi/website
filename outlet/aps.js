// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbzkvLBjofJd10aauSvDTqHn0__fYsKIw24cgRzBOnQZbTgNs1NoeLqW9xuCU88h9gL1/exec'; 

let currentUser = JSON.parse(localStorage.getItem('outletUser')) || null;
let salesChart;

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showApp();
    } else {
        document.getElementById('login-view').classList.remove('d-none');
    }
});

// Helper Function: Panggil API GAS
async function callAPI(action, payload) {
    Swal.showLoading();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        const result = await response.json();
        Swal.close();
        if (result.status === 'success') return result.data;
        else throw new Error(result.message);
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
        throw error;
    }
}

// ==== LOGIN SYSTEM ====
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    
    try {
        const data = await callAPI('login', { username: user, password: pass });
        localStorage.setItem('outletUser', JSON.stringify(data));
        currentUser = data;
        showApp();
    } catch (error) {
        // Error dihandle oleh callAPI
    }
});

function logout() {
    localStorage.removeItem('outletUser');
    location.reload();
}

// ==== ROUTING SPA ====
function showApp() {
    document.getElementById('login-view').classList.add('d-none');
    document.getElementById('app-view').classList.remove('d-none');
    document.getElementById('user-info').innerText = `${currentUser.nama} (${currentUser.role})`;
    
    // Setup Navigasi Sidebar
    document.querySelectorAll('.nav-menu').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-menu').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.view-section').forEach(v => v.classList.add('d-none'));
            document.getElementById(`view-${target}`).classList.remove('d-none');
            
            if(target === 'dashboard') loadDashboard();
            if(target === 'laporan') loadLaporan();
        });
    });

    loadDashboard(); // Load awal
}

// ==== MODULE: DASHBOARD ====
async function loadDashboard() {
    const data = await callAPI('getDashboardData', { 
        outletId: currentUser.outletId, 
        role: currentUser.role 
    });
    
    // Update KPI Card
    document.getElementById('kpi-omset').innerText = `Rp ${data.kpi.omset.toLocaleString('id-ID')}`;
    document.getElementById('kpi-bill').innerText = data.kpi.totalBill;
    document.getElementById('kpi-avgbill').innerText = `Rp ${data.kpi.avgBill.toLocaleString('id-ID')}`;

    // Render Chart
    const ctx = document.getElementById('salesChart').getContext('2d');
    if(salesChart) salesChart.destroy();
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.chart.labels,
            datasets: [{
                label: 'Omset Harian (Rp)',
                data: data.chart.values,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true }
    });
}

// ==== MODULE: LAPORAN HARIAN ====
let tableLaporan;
async function loadLaporan() {
    const data = await callAPI('getData', { 
        sheetName: 'DAILY_REPORT', 
        outletId: currentUser.outletId, 
        role: currentUser.role 
    });

    const tbody = document.getElementById('tbody-laporan');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        const dateStr = new Date(row.Tanggal).toLocaleDateString('id-ID');
        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td>${row.OutletID}</td>
                <td>Rp ${parseFloat(row.Sales).toLocaleString('id-ID')}</td>
                <td>Rp ${parseFloat(row.Cash).toLocaleString('id-ID')}</td>
                <td>Rp ${parseFloat(row.QRIS).toLocaleString('id-ID')}</td>
                <td>${row.TotalBill}</td>
            </tr>
        `;
    });

    if(!tableLaporan) {
        tableLaporan = $('#table-laporan').DataTable();
    }
}

async function saveLaporan() {
    const payload = {
        Tanggal: document.getElementById('lap-tanggal').value,
        OutletID: currentUser.outletId,
        Sales: document.getElementById('lap-sales').value,
        Cash: document.getElementById('lap-cash').value,
        QRIS: document.getElementById('lap-qris').value,
        TotalBill: document.getElementById('lap-bill').value,
        // Kolom lain bisa di-set default atau dihitung
        AverageBill: document.getElementById('lap-sales').value / document.getElementById('lap-bill').value
    };

    try {
        await callAPI('saveData', { sheetName: 'DAILY_REPORT', data: payload });
        Swal.fire('Sukses', 'Laporan berhasil disimpan', 'success');
        
        // Sesuai koreksi: Menyalin hasil laporan
        const textLaporan = `Laporan ${payload.Tanggal}\nOutlet: ${payload.OutletID}\nSales: Rp${payload.Sales}\nTotal Bill: ${payload.TotalBill}`;
        navigator.clipboard.writeText(textLaporan);
        
        $('#modalLaporan').modal('hide');
        document.getElementById('form-laporan').reset();
        loadLaporan(); // Reload table
    } catch (error) {
        // Error handled in callAPI
    }
}
