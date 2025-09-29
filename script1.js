// Google Apps Script URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJpnhg35l4xVOHq4KfUgpSQNDa6xWlcsZn4GOPlCDjfmtdXWwVxWZ7aKcE6o_6w1s/exec';

// DOM Elements
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
const headerFullName = document.getElementById('headerFullName');
const headerOccupation = document.getElementById('headerOccupation');
const headerAmount = document.getElementById('headerAmount');
const headerTransferDate = document.getElementById('headerTransferDate');

let allDonorsData = [];
let filteredDonorsData = [];
let currentPage = 1;
const itemsPerPage = 25;
const maxPageButtons = 5;

// Sorting
let currentSortColumn = 'วันที่แจ้งโอนเงิน';
let currentSortDirection = 'desc';
let refreshIntervalId;

// Show page
function showPage(pageToShow) {
    homePage.classList.add('d-none');
    donationFormPage.classList.add('d-none');
    pageToShow.classList.remove('d-none');
}

// Get current date/time
function getCurrentDateTime() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}:${seconds}` };
}

// Set Thai date/time
function setCurrentTransferDateTime() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth();
    const yearBE = today.getFullYear() + 543;
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    if (transferDateInput) transferDateInput.value = `${day} ${thaiMonths[month]} ${yearBE}`;
    if (transferTimeInput) transferTimeInput.value = `${hours}:${minutes}:${seconds}`;
}

// SweetAlert2 helper
function showAppAlert(message, icon, presentation='toast', showLoadingSpinner=false, timer=undefined) {
    let options = { title: message, icon, showConfirmButton:false, allowOutsideClick:false, allowEscapeKey:false, timer };
    if (presentation==='toast'){
        options.toast=true; options.position='top-end'; options.allowOutsideClick=true; options.allowEscapeKey=true;
    } else {
        options.toast=false; options.position='center';
        if (icon==='info' && showLoadingSpinner){
            options.didOpen=()=>Swal.showLoading(); timer=undefined;
        } else if (icon==='error'){ options.showConfirmButton=true; options.allowOutsideClick=true; options.allowEscapeKey=true; }
    }
    return Swal.fire(options);
}

// Fetch donors with retries
async function fetchDonors(retries=3){
    for (let i=0;i<retries;i++){
        try {
            const response = await fetch(APPS_SCRIPT_URL+'?action=getDonors');
            if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawData = await response.json();
            if (rawData.status==='error') { showAppAlert(rawData.message,'error','modal'); return []; }
            if(!Array.isArray(rawData)) throw new Error("Invalid data format received from server.");
            return rawData;
        } catch(e){
            if(i<retries-1){ await new Promise(r=>setTimeout(r,Math.pow(2,i)*1000)); continue; }
            showAppAlert('ไม่สามารถโหลดข้อมูลผู้บริจาคได้','error','modal');
            return [];
        }
    }
    return [];
}

// Sorting
function sortTable(columnKey){
    if(currentSortColumn===columnKey) currentSortDirection = currentSortDirection==='asc'?'desc':'asc';
    else{
        currentSortColumn = columnKey;
        if(columnKey==='จำนวนเงิน'||columnKey==='วันที่แจ้งโอนเงิน') currentSortDirection='desc';
        else currentSortDirection='asc';
    }
   // ตั้ง highlight คอลัมน์ที่ถูกเลือก
    document.querySelectorAll('.table thead th').forEach(th => th.classList.remove('sorted'));
    const activeTh = document.querySelector(`.table thead th[data-sort-key="${columnKey}"]`);
    if(activeTh) activeTh.classList.add('sorted');
    
    filteredDonorsData.sort((a,b)=>{
        let valA=a[columnKey], valB=b[columnKey];
        if(columnKey==='จำนวนเงิน'){ valA=parseFloat(valA)||0; valB=parseFloat(valB)||0; return currentSortDirection==='asc'?valA-valB:valB-valA;}
        else if(columnKey==='วันที่แจ้งโอนเงิน'){
            const dateTimeA=new Date(`${a['วันที่แจ้งโอนเงิน']||'1970-01-01'}T${a['เวลาแจ้งโอนเงิน']||'00:00:00'}`);
            const dateTimeB=new Date(`${b['วันที่แจ้งโอนเงิน']||'1970-01-01'}T${b['เวลาแจ้งโอนเงิน']||'00:00:00'}`);
            return currentSortDirection==='asc'?dateTimeA-dateTimeB:dateTimeB-dateTimeA;
        } else return currentSortDirection==='asc'?String(valA||'').toLowerCase().localeCompare(String(valB||'').toLowerCase()):String(valB||'').toLowerCase().localeCompare(String(valA||'').toLowerCase());
    });
    currentPage=1; renderTable(filteredDonorsData);
}

// Render table
function renderTable(donors){
    if(!Array.isArray(donors)){ donorsTableBody.innerHTML='<tr><td colspan="5" class="text-center text-danger py-4">ไม่สามารถแสดงข้อมูลได้</td></tr>'; totalAmountSpan.textContent='0'; totalDonorsSpan.textContent='0'; paginationButtonsContainer.innerHTML=''; return; }
    const totalPages=Math.ceil(donors.length/itemsPerPage);
    if(currentPage<1) currentPage=1;
    if(currentPage>totalPages && totalPages>0) currentPage=totalPages;
    if(totalPages===0) currentPage=0;
    const startIndex=(currentPage-1)*itemsPerPage;
    const endIndex=startIndex+itemsPerPage;
    const paginatedDonors=donors.slice(startIndex,endIndex);

    document.querySelectorAll('.table thead th').forEach(th=>{
        const sortIcon = th.querySelector('.sort-icon'); if(sortIcon) sortIcon.textContent='';
        if(th.getAttribute('data-sort-key')===currentSortColumn && sortIcon) sortIcon.textContent=currentSortDirection==='asc'?' ▲':' ▼';
    });

    if(paginatedDonors.length===0){
        const messageContent=searchInput.value.trim()!==''?'ไม่พบข้อมูลผู้บริจาคที่ตรงกับคำค้นหา':'ไม่มีข้อมูล';
        donorsTableBody.innerHTML=`<tr><td colspan="5" class="text-center text-info py-4">${messageContent}</td></tr>`;
    } else {
        donorsTableBody.innerHTML='';
        paginatedDonors.forEach((donor,index)=>{
            const row=donorsTableBody.insertRow();
            row.insertCell(0).textContent=startIndex+index+1;
            row.insertCell(1).textContent=donor['ชื่อ-นามสกุล']||'-';
            row.insertCell(2).textContent=donor['รุ่น/อาชีพ']||'-';
            row.insertCell(3).textContent=parseFloat(donor['จำนวนเงิน']).toLocaleString('th-TH')||'0';
            row.insertCell(4).textContent=donor['วันที่แจ้งโอนเงิน']?new Date(donor['วันที่แจ้งโอนเงิน']).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'-';
        });
    }

    const totalAmount = allDonorsData.reduce((sum, donor) => sum + (parseFloat(donor['จำนวนเงิน'])||0),0);
    totalAmountSpan.textContent = totalAmount.toLocaleString('th-TH');
    totalDonorsSpan.textContent = allDonorsData.length;

    paginationButtonsContainer.innerHTML='';
    if(totalPages>0){
        const createButton=(page,text,disabled=false,isActive=false)=>{
            const button=document.createElement('button');
            button.textContent=text; button.classList.add('pagination-btn');
            if(isActive) button.classList.add('active');
            if(disabled) button.disabled=true;
            button.addEventListener('click',()=>{currentPage=page; renderTable(donors);});
            return button;
        };
        paginationButtonsContainer.appendChild(createButton(currentPage-1,'« หน้าก่อนหน้า',currentPage===1));
        const startPage=Math.max(1,currentPage-Math.floor(maxPageButtons/2));
        const endPage=Math.min(totalPages,startPage+maxPageButtons-1);
        if(startPage>1){ const ellipsis=document.createElement('span'); ellipsis.textContent='...'; ellipsis.classList.add('pagination-ellipsis'); paginationButtonsContainer.appendChild(ellipsis); }
        for(let i=startPage;i<=endPage;i++) paginationButtonsContainer.appendChild(createButton(i,i.toString(),false,i===currentPage));
        if(endPage<totalPages){ if(endPage<totalPages-1){ const ellipsis=document.createElement('span'); ellipsis.textContent='...'; ellipsis.classList.add('pagination-ellipsis'); paginationButtonsContainer.appendChild(ellipsis); } paginationButtonsContainer.appendChild(createButton(totalPages,totalPages.toString())); }
        paginationButtonsContainer.appendChild(createButton(currentPage+1,'หน้าถัดไป »',currentPage===totalPages));
    }
}

// Filter donors
function filterDonors(){
    const searchTerm=searchInput.value.toLowerCase().trim();
    const category=searchCategory.value;
    filteredDonorsData = allDonorsData.filter(donor=>{
        const fullName=String(donor['ชื่อ-นามสกุล']||'').toLowerCase();
        const rawTransferDate=String(donor['วันที่แจ้งโอนเงิน']||'');
        let formattedTransferDate='';
        try{ if(rawTransferDate){ const dateObj=new Date(rawTransferDate); if(!isNaN(dateObj.getTime())) formattedTransferDate=dateObj.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}).toLowerCase(); } } catch(e){ console.error(e);}
        const transferTime=String(donor['เวลาแจ้งโอนเงิน']||'').toLowerCase();
        const amount=String(donor['จำนวนเงิน']||'');
        const occupation=String(donor['รุ่น/อาชีพ']||'').toLowerCase();
        if(searchTerm==='') return true;
        switch(category){
            case 'fullName': return fullName.includes(searchTerm);
            case 'transferDate': return rawTransferDate.includes(searchTerm)||formattedTransferDate.includes(searchTerm);
            case 'amount': return amount.includes(searchTerm);
            case 'occupation': return occupation.includes(searchTerm);
            case 'all':
            default: return fullName.includes(searchTerm)||rawTransferDate.includes(searchTerm)||formattedTransferDate.includes(searchTerm)||transferTime.includes(searchTerm)||amount.includes(searchTerm)||occupation.includes(searchTerm);
        }
    });
    currentPage=1; sortTable(currentSortColumn);
}

// Event Listeners
showDonationFormBtn.addEventListener('click',()=>{
    donationForm.reset();
    setCurrentTransferDateTime();
    showPage(donationFormPage);
});
backToHomeBtn.addEventListener('click',()=>{
    showPage(homePage);
    fetchDonors(3).then(data=>{allDonorsData=data; filteredDonorsData=[...allDonorsData]; sortTable(currentSortColumn);});
});
searchInput.addEventListener('keyup',filterDonors);
searchCategory.addEventListener('change',()=>{
    const selectedOptionText = searchCategory.options[searchCategory.selectedIndex].textContent;
    searchInput.placeholder = `กรอกคำค้นหา: ${selectedOptionText.replace('ค้นหา: ', '')}...`;
    filterDonors();
});
headerFullName.addEventListener('click',()=>sortTable('ชื่อ-นามสกุล'));
headerOccupation.addEventListener('click',()=>sortTable('รุ่น/อาชีพ'));
headerAmount.addEventListener('click',()=>sortTable('จำนวนเงิน'));
headerTransferDate.addEventListener('click',()=>sortTable('วันที่แจ้งโอนเงิน'));

// Form submission
donationForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    showAppAlert('กำลังบันทึกข้อมูล...','info','modal',true,undefined); // Loading modal ค้างจนเสร็จ

    const currentDateTime=getCurrentDateTime();
    const transferDate=currentDateTime.date;
    const transferTime=currentDateTime.time;

    const fullName=document.getElementById('fullName').value;
    const occupation=document.getElementById('occupation').value;
    const phoneNumber=document.getElementById('phoneNumber').value;
    const amount=document.getElementById('amount').value;
    const donationDate=document.getElementById('donationDate').value;
    const slipImageInput=document.getElementById('slipImage');
    const slipFile=slipImageInput.files[0];

    if(!slipFile){ Swal.close(); showAppAlert('กรุณาแนบสลิปโอนเงิน','error','modal'); return; }

    const reader=new FileReader();
    reader.readAsDataURL(slipFile);

    reader.onload=async()=>{
        const base64Image=reader.result.split(',')[1];
        const mimeType=slipFile.type;
        const fileExtension=slipFile.name.split('.').pop();
        const safeFullName=fullName
            .trim()
            .replace(/\s+/g,'_')
            .replace(/[\/\\:*?"<>|]/g,'');
        const fileName = `${safeFullName}.${fileExtension}`;
        const params=new URLSearchParams();
        params.append('action','addDonation');
        params.append('transferDate',transferDate);
        params.append('transferTime',transferTime);
        params.append('fullName',fullName);
        params.append('occupation',occupation);
        params.append('phoneNumber',phoneNumber);
        params.append('amount',amount);
        params.append('donationDate',donationDate);
        params.append('base64Image',base64Image);
        params.append('mimeType',mimeType);
        
        // ✅ encode ก่อนส่งไปยัง GAS
        params.append('fileName',encodeURIComponent(fileName));

        const options={ method:'POST', body:params.toString(), headers:{'Content-Type':'application/x-www-form-urlencoded'} };

        for(let i=0;i<3;i++){
            try{
                const response=await fetch(APPS_SCRIPT_URL,options);
                if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result=await response.json();
                if(result.status==='success'){
                    Swal.close();
                    showPage(homePage);
                    showAppAlert('บันทึกข้อมูลเรียบร้อยแล้ว','success','modal',false,2000);
                    donationForm.reset();
                    const updatedData=await fetchDonors(3);
                    allDonorsData=updatedData;
                    filteredDonorsData=[...allDonorsData];
                    sortTable(currentSortColumn);
                    break;
                } else throw new Error(result.message||'บันทึกข้อมูลไม่สำเร็จ');
            } catch(error){
                if(i<2){ await new Promise(r=>setTimeout(r,Math.pow(2,i)*1000)); continue; }
                Swal.close();
                showAppAlert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message}`,'error','modal');
            }
        }
    };
    reader.onerror=(error)=>{ Swal.close(); showAppAlert('ไม่สามารถอ่านไฟล์รูปภาพได้','error','modal'); };
});

// Initial load
document.addEventListener('DOMContentLoaded',()=>{

    // ✅ แสดงแจ้งเตือนเมื่อเปิดเว็บครั้งแรก
  Swal.fire({
    title: 'ยินดีต้อนรับ',
    text: 'ขอบคุณที่ร่วมสนับสนุนการสร้างโดม โรงเรียนชัยบาดาลวิทยา',
    icon: 'info',
    confirmButtonText: 'ตกลง',
    allowOutsideClick: false
  }); 

    if(refreshIntervalId) clearInterval(refreshIntervalId);
    donorsTableBody.innerHTML='<tr><td colspan="5" class="text-center text-info py-4"><div class="spinner-border text-info spinner-border-sm me-2" role="status"><span class="visually-hidden">Loading...</span></div>กำลังโหลดข้อมูลผู้บริจาค...</td></tr>';
    fetchDonors(3).then(data=>{allDonorsData=data; filteredDonorsData=[...allDonorsData]; sortTable(currentSortColumn);});
    donationFormPage.classList.add('d-none');
    searchCategory.dispatchEvent(new Event('change'));
    refreshIntervalId=setInterval(async()=>{
        const newData=await fetchDonors(3);
        if(JSON.stringify(newData)!==JSON.stringify(allDonorsData)){ allDonorsData=newData; filterDonors(); }
    },3000);
});

