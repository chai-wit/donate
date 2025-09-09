// Google Apps Script URL for data submission and retrieval
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJpnhg35l4xVOHq4KfUgpSQNDa6xWlcsZn4GOPlCDjfmtdXWwVxWZ7aKcE6o_6w1s/exec';

// DOM elements
const homePage = document.getElementById('homePage');
const donationFormPage = document.getElementById('donationFormPage');
const showDonationFormBtn = document.getElementById('showDonationFormBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const donationForm = document.getElementById('donationForm');
const searchInput = document.getElementById('searchInput');
const searchCategory = document.getElementById('searchCategory');
const donorsTableBody = document.getElementById('donorsTableBody');
const totalAmountSpan = document.getElementById('totalAmount');
const totalDonorsSpan = document.getElementById('totalDonors');
const paginationButtonsContainer = document.getElementById('paginationButtons');

const transferDateInput = document.getElementById('transferDate');
const transferTimeInput = document.getElementById('transferTime');

// Table headers
const headerFullName = document.getElementById('headerFullName');
const headerOccupation = document.getElementById('headerOccupation');
const headerAmount = document.getElementById('headerAmount');
const headerTransferDate = document.getElementById('headerTransferDate');

let allDonorsData = [];
let filteredDonorsData = [];
let currentPage = 1;
const itemsPerPage = 25;
const maxPageButtons = 5;

// Sorting state
let currentSortColumn = 'วันที่แจ้งโอนเงิน';
let currentSortDirection = 'desc';

let refreshIntervalId;

/* ---------- Utility functions ---------- */

// Format JS Date → Thai BE string
function formatDateToThaiBE(dateObj) {
    const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = dateObj.getDate();
    const month = thaiMonths[dateObj.getMonth()];
    const yearBE = dateObj.getFullYear() + 543;
    return `${day} ${month} ${yearBE}`;
}

// Parse Thai BE string → JS Date
function parseThaiDateToJS(thaiDateStr) {
    const thaiMonths = {
        'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
        'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
    };
    const parts = thaiDateStr.trim().split(" ");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = thaiMonths[parts[1]];
    const yearAD = parseInt(parts[2], 10) - 543;
    return new Date(yearAD, month, day);
}

// Show/hide pages
function showPage(pageToShow) {
    homePage.classList.add('d-none');
    donationFormPage.classList.add('d-none');
    pageToShow.classList.remove('d-none');
}

// Set current Thai BE date/time
function setCurrentTransferDateTime() {
    const now = new Date();
    if (transferDateInput) {
        transferDateInput.value = formatDateToThaiBE(now);
    }
    if (transferTimeInput) {
        transferTimeInput.value = now.toLocaleTimeString('th-TH', { hour12: false });
    }
}

// SweetAlert wrapper
function showAppAlert(message, icon, presentation = 'toast', showLoadingSpinner = false, timer = undefined) {
    let options = {
        title: message,
        icon: icon,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        timerProgressBar: false,
        timer: timer,
    };
    if (presentation === 'toast') {
        options.toast = true;
        options.position = 'top-end';
        options.allowOutsideClick = true;
        options.allowEscapeKey = true;
    } else {
        options.toast = false;
        options.position = 'center';
        if (icon === 'error') {
            options.showConfirmButton = true;
            options.allowOutsideClick = true;
            options.allowEscapeKey = true;
        } else if (icon === 'info' && showLoadingSpinner) {
            options.didOpen = () => Swal.showLoading();
        }
    }
    return Swal.fire(options);
}

/* ---------- Data fetch ---------- */
async function fetchDonors(retries = 3) {
    try {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(APPS_SCRIPT_URL + '?action=getDonors');
                if (!response.ok) {
                    throw new Error(`HTTP error! ${response.status}`);
                }
                const rawData = await response.json();
                if (!Array.isArray(rawData)) throw new Error("Invalid data format");
                return rawData;
            } catch (err) {
                if (i < retries - 1) {
                    await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
                } else {
                    showAppAlert('โหลดข้อมูลผู้บริจาคไม่สำเร็จ', 'error', 'modal');
                    return [];
                }
            }
        }
    } finally {
        if (Swal.isVisible()) Swal.close();
    }
    return [];
}

/* ---------- Sorting & Rendering ---------- */
function sortTable(columnKey) {
    if (currentSortColumn === columnKey) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnKey;
        currentSortDirection = columnKey === 'จำนวนเงิน' || columnKey === 'วันที่แจ้งโอนเงิน'
            ? 'desc' : 'asc';
    }
    filteredDonorsData.sort((a, b) => {
        let valA = a[columnKey];
        let valB = b[columnKey];
        if (columnKey === 'จำนวนเงิน') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        } else if (columnKey === 'วันที่แจ้งโอนเงิน') {
            const dateA = parseThaiDateToJS(valA) || new Date(0);
            const dateB = parseThaiDateToJS(valB) || new Date(0);
            return currentSortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        } else {
            return currentSortDirection === 'asc'
                ? String(valA || '').localeCompare(String(valB || ''))
                : String(valB || '').localeCompare(String(valA || ''));
        }
    });
    currentPage = 1;
    renderTable(filteredDonorsData);
}

function renderTable(donors) {
    const totalPages = Math.ceil(donors.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = donors.slice(startIndex, startIndex + itemsPerPage);

    donorsTableBody.innerHTML = '';
    if (paginated.length === 0) {
        donorsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-info py-4">
        ${searchInput.value.trim() ? 'ไม่พบข้อมูล' : 'ไม่มีข้อมูล'}
        </td></tr>`;
    } else {
        paginated.forEach((donor, i) => {
            const row = donorsTableBody.insertRow();
            row.insertCell(0).textContent = startIndex + i + 1;
            row.insertCell(1).textContent = donor['ชื่อ-นามสกุล'] || '-';
            row.insertCell(2).textContent = donor['รุ่น/อาชีพ'] || '-';
            row.insertCell(3).textContent = parseFloat(donor['จำนวนเงิน']).toLocaleString('th-TH') || '0';
            row.insertCell(4).textContent = donor['วันที่แจ้งโอนเงิน'] || '-';
        });
    }

    totalAmountSpan.textContent = allDonorsData.reduce((s, d) => s + (parseFloat(d['จำนวนเงิน']) || 0), 0).toLocaleString('th-TH');
    totalDonorsSpan.textContent = allDonorsData.length;

    paginationButtonsContainer.innerHTML = '';
    if (totalPages > 0) {
        const createBtn = (page, text, disabled, active) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.classList.add('pagination-btn');
            if (active) btn.classList.add('active');
            if (disabled) btn.disabled = true;
            btn.onclick = () => { currentPage = page; renderTable(donors); };
            return btn;
        };
        paginationButtonsContainer.appendChild(createBtn(currentPage - 1, '«', currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            paginationButtonsContainer.appendChild(createBtn(i, i, false, i === currentPage));
        }
        paginationButtonsContainer.appendChild(createBtn(currentPage + 1, '»', currentPage === totalPages));
    }
}

/* ---------- Filtering ---------- */
function filterDonors() {
    const term = searchInput.value.toLowerCase().trim();
    const category = searchCategory.value;
    filteredDonorsData = allDonorsData.filter(d => {
        const fullName = (d['ชื่อ-นามสกุล'] || '').toLowerCase();
        const dateBE = (d['วันที่แจ้งโอนเงิน'] || '').toLowerCase();
        const amount = String(d['จำนวนเงิน'] || '');
        const occ = (d['รุ่น/อาชีพ'] || '').toLowerCase();
        if (!term) return true;
        switch (category) {
            case 'fullName': return fullName.includes(term);
            case 'transferDate': return dateBE.includes(term);
            case 'amount': return amount.includes(term);
            case 'occupation': return occ.includes(term);
            default: return fullName.includes(term) || dateBE.includes(term) || amount.includes(term) || occ.includes(term);
        }
    });
    currentPage = 1;
    sortTable(currentSortColumn);
}

/* ---------- Event listeners ---------- */
showDonationFormBtn.onclick = () => {
    donationForm.reset();
    setCurrentTransferDateTime();
    showPage(donationFormPage);
};

backToHomeBtn.onclick = () => {
    showPage(homePage);
    fetchDonors().then(d => { allDonorsData = d; filteredDonorsData = [...d]; sortTable(currentSortColumn); });
};

searchInput.onkeyup = filterDonors;
searchCategory.onchange = () => {
    searchInput.placeholder = `ค้นหา: ${searchCategory.options[searchCategory.selectedIndex].textContent.replace('ค้นหา: ', '')}`;
    filterDonors();
};

headerFullName.onclick = () => sortTable('ชื่อ-นามสกุล');
headerOccupation.onclick = () => sortTable('รุ่น/อาชีพ');
headerAmount.onclick = () => sortTable('จำนวนเงิน');
headerTransferDate.onclick = () => sortTable('วันที่แจ้งโอนเงิน');

/* ---------- Submit donation form ---------- */
donationForm.onsubmit = async e => {
    e.preventDefault();
    showAppAlert('กำลังบันทึก...', 'info', 'modal', true);

    const transferDate = transferDateInput.value; // BE date
    const transferTime = transferTimeInput.value;
    const fullName = document.getElementById('fullName').value;
    const occupation = document.getElementById('occupation').value;
    const phone = document.getElementById('phoneNumber').value;
    const amount = document.getElementById('amount').value;
    const donationDate = document.getElementById('donationDate').value;
    const slipFile = document.getElementById('slipImage').files[0];
    if (!slipFile) { Swal.close(); return showAppAlert('กรุณาแนบสลิป', 'error', 'modal'); }

    const reader = new FileReader();
    reader.onload = async () => {
        const base64Image = reader.result.split(',')[1];
        const mimeType = slipFile.type;
        const ext = slipFile.name.split('.').pop();
        const safeName = fullName.trim().replace(/\s+/g, '_').replace(/[^\wก-ฮ]/g, '') || 'donor';
        const fileName = `${safeName}_${transferDate}_${transferTime.replace(/:/g, '-')}_slip.${ext}`;

        const params = new URLSearchParams();
        params.append('action', 'addDonation');
        params.append('transferDate', transferDate);
        params.append('transferTime', transferTime);
        params.append('fullName', fullName);
        params.append('occupation', occupation);
        params.append('phoneNumber', phone);
        params.append('amount', amount);
        params.append('donationDate', donationDate);
        params.append('base64Image', base64Image);
        params.append('mimeType', mimeType);
        params.append('fileName', fileName);

        try {
            const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            const result = await res.json();
            if (result.status === 'success') {
                Swal.close();
                showPage(homePage);
                showAppAlert('บันทึกเรียบร้อย', 'success', 'modal', false, 2000);
                donationForm.reset();
                allDonorsData = await fetchDonors();
                filteredDonorsData = [...allDonorsData];
                sortTable(currentSortColumn);
            } else throw new Error(result.message);
        } catch (err) {
            Swal.close();
            showAppAlert('ผิดพลาด: ' + err.message, 'error', 'modal');
        }
    };
    reader.onerror = () => { Swal.close(); showAppAlert('อ่านไฟล์ไม่สำเร็จ', 'error', 'modal'); };
    reader.readAsDataURL(slipFile);
};

/* ---------- Initial load ---------- */
document.addEventListener('DOMContentLoaded', () => {
    donorsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-info py-4">กำลังโหลด...</td></tr>';
    fetchDonors().then(d => { allDonorsData = d; filteredDonorsData = [...d]; sortTable(currentSortColumn); });
    searchCategory.dispatchEvent(new Event('change'));
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    refreshIntervalId = setInterval(async () => {
        const newData = await fetchDonors();
        if (JSON.stringify(newData) !== JSON.stringify(allDonorsData)) {
            allDonorsData = newData;
            filterDonors();
        }
    }, 15000); // refresh ทุก 15 วินาที
});
