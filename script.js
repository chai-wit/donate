 // Google Apps Script URL for data submission and retrieval
        // ***สำคัญ***: กรุณาตรวจสอบให้แน่ใจว่า URL นี้ถูกต้อง และมีการตั้งค่าการใช้งานเป็น "Anyone" หรือ "anyone, even anonymous"
        // คุณสามารถหา URL ที่ถูกต้องได้จาก Google Apps Script -> Deploy -> New deployment -> Web app -> Copy URL
        const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJpnhg35l4xVOHq4KfUgpSQNDa6xWlcsZn4GOPlCDjfmtdXWwVxWZ7aKcE6o_6w1s/exec';

        // Get DOM elements
        const homePage = document.getElementById('homePage');
        const donationFormPage = document.getElementById('donationFormPage');
        const showDonationFormBtn = document.getElementById('showDonationFormBtn');
        const backToHomeBtn = document.getElementById('backToHomeBtn');
        const donationForm = document.getElementById('donationForm');
        const searchInput = document.getElementById('searchInput');
        const searchCategory = document.getElementById('searchCategory'); // Re-added: Search category dropdown
        const donorsTableBody = document.getElementById('donorsTableBody');
        const totalAmountSpan = document.getElementById('totalAmount');
        const totalDonorsSpan = document.getElementById('totalDonors');
        const paginationButtonsContainer = document.getElementById('paginationButtons'); 

        // Added references to new input fields
        const transferDateInput = document.getElementById('transferDate');
        const transferTimeInput = document.getElementById('transferTime');

        // Table header elements for sorting
        const headerFullName = document.getElementById('headerFullName');
        const headerOccupation = document.getElementById('headerOccupation'); // Added for sorting Occupation
        const headerAmount = document.getElementById('headerAmount');
        const headerTransferDate = document.getElementById('headerTransferDate');

        let allDonorsData = []; // To store all fetched donor data (unfiltered)
        let filteredDonorsData = []; // To store filtered donor data (for pagination)
        let currentPage = 1;
        const itemsPerPage = 25;
        const maxPageButtons = 5;

        // Sorting state
        let currentSortColumn = 'วันที่แจ้งโอนเงิน'; // Default sort column (latest first)
        let currentSortDirection = 'desc'; // Default sort direction

        let refreshIntervalId; // Variable to hold the interval ID for periodic refresh

        /**
         * Function to show a specific page and hide others.
         * @param {HTMLElement} pageToShow - The page element to show.
         */
        function showPage(pageToShow) {
            homePage.classList.add('d-none');
            donationFormPage.classList.add('d-none');
            pageToShow.classList.remove('d-none');
        }

        /**
         * Generates current date and time in YYYY-MM-DD and HH:MM:SS format.
         * @returns {{date: string, time: string}} - Current date and time.
         */
        function getCurrentDateTime() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const hours = String(today.getHours()).padStart(2, '0');
            const minutes = String(today.getMinutes()).padStart(2, '0');
            const seconds = String(today.getSeconds()).padStart(2, '0');

            return {
                date: `${year}-${month}-${day}`,
                time: `${hours}:${minutes}:${seconds}`
            };
        }

        /**
         * Sets the current date and time into the readonly input fields.
         
        function setCurrentTransferDateTime() {
            const currentDateTime = getCurrentDateTime();
            if (transferDateInput) {
                transferDateInput.value = currentDateTime.date;
            }
            if (transferTimeInput) {
                transferTimeInput.value = currentDateTime.time;
            }
        }
        */
       function setCurrentTransferDateTime() {
            const today = new Date();
            const day = today.getDate();
            const month = today.getMonth();
            const yearBE = today.getFullYear() + 543;
            const hours = String(today.getHours()).padStart(2, '0');
            const minutes = String(today.getMinutes()).padStart(2, '0');
            const seconds = String(today.getSeconds()).padStart(2, '0');

            const thaiMonths = [
                'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
            ];

            if (transferDateInput) {
                transferDateInput.value = `${day} ${thaiMonths[month]} ${yearBE}`;
            }
            if (transferTimeInput) { 
                transferTimeInput.value = `${hours}:${minutes}:${seconds}`;
            }
        }

        /**
         * Displays a SweetAlert2 notification.
         * @param {string} message - The message to display.
         * @param {'success'|'error'|'info'|'warning'|'question'} icon - The icon type.
         * @param {'toast'|'modal'} presentation - 'toast' for small, auto-closing, top-end; 'modal' for full screen, centered.
         * @param {boolean} showLoadingSpinner - If true, shows a loading spinner (for 'info' icon).
         * @param {number|undefined} timer - Timer in milliseconds, or undefined for no auto-close.
         * @returns {Promise<SweetAlertResult>} - A promise that resolves when the alert closes.
         */
        function showAppAlert(message, icon, presentation = 'toast', showLoadingSpinner = false, timer = undefined) {
            let options = {
                title: message,
                icon: icon,
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                timerProgressBar: false,
                timer: timer, // Set timer from parameter
            };

            if (presentation === 'toast') {
                options.toast = true;
                options.position = 'top-end';
                options.showConfirmButton = false;
                options.allowOutsideClick = true;
                options.allowEscapeKey = true;
            } else { // 'modal'
                options.toast = false;
                options.position = 'center';
                options.allowOutsideClick = false;
                options.allowEscapeKey = false;
                if (icon === 'error') {
                    options.showConfirmButton = true;
                    options.timer = undefined;
                    options.allowOutsideClick = true; // Allow closing error modal
                    options.allowEscapeKey = true; // Allow closing error modal
                } else if (icon === 'info' && showLoadingSpinner) {
                    options.didOpen = () => {
                        Swal.showLoading();
                    };
                    options.timer = undefined;
                }
            }
            return Swal.fire(options);
        }

        /**
         * Fetches donor data from Google Apps Script.
         * Implements exponential backoff for retries.
         * @param {number} retries - Number of retry attempts.
         * @returns {Promise<Array>} - A promise that resolves with the donor data.
         */
        async function fetchDonors(retries = 3) { 
            try {
                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(APPS_SCRIPT_URL + '?action=getDonors');
                        console.log('Fetch Donors Response Status:', response.status);
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('Fetch Donors HTTP Error Response Text:', errorText);
                            if (response.status === 403) {
                                throw new Error('การเข้าถึงถูกปฏิเสธ: กรุณาตรวจสอบการตั้งค่าการเข้าถึง Apps Script (Who has access to the app ควรเป็น Anyone)');
                            }
                            throw new Error(`HTTP error! status: ${response.status} ${response.statusText || ''} - ${errorText.substring(0, 100)}...`);
                        }
                        const rawData = await response.json();

                        if (typeof rawData === 'object' && rawData !== null && rawData.status === 'error') {
                            console.error("Received error data from Apps Script:", rawData.message);
                            showAppAlert(`ข้อผิดพลาดจากเซิร์ฟเวอร์: ${rawData.message}`, 'error', 'modal');
                            return [];
                        }
                        
                        if (!Array.isArray(rawData)) {
                            console.error("Received non-array data from Apps Script: Not an array.", rawData);
                            throw new Error("Invalid data format received from server. Expected an array.");
                        }

                        return rawData;
                    } catch (error) {
                        console.error('Error during fetchDonors attempt', i + 1, ':', error);
                        if (i < retries - 1) {
                            const delay = Math.pow(2, i) * 1000;
                            await new Promise(res => setTimeout(res, delay));
                            console.log(`Retrying fetchDonors... Attempt ${i + 2}`);
                        } else {
                            if (Swal.isVisible()) { // Close if any SweetAlert was opened by a previous function
                                Swal.close();
                            }
                            const errorMessage = error.message.includes('การเข้าถึงถูกปฏิเสธ') ? error.message : 'ไม่สามารถโหลดข้อมูลผู้บริจาคได้ กรุณาลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
                            showAppAlert(errorMessage, 'error', 'modal');
                            return [];
                        }
                    }
                }
            } finally {
                if (Swal.isVisible()) { // Final check to close any lingering SweetAlert
                    Swal.close();
                }
            }
            return [];
        }

        /**
         * Sorts the filteredDonorsData based on the currentSortColumn and currentSortDirection.
         * @param {string} columnKey - The key of the column to sort by.
         */
        function sortTable(columnKey) {
            if (currentSortColumn === columnKey) {
                // If the same column is clicked again, toggle the sort direction
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // If a new column is clicked, set it as the current sort column
                currentSortColumn = columnKey;
                // Set default sort direction based on column type
                if (columnKey === 'จำนวนเงิน') {
                    currentSortDirection = 'desc'; // Default for amount is descending (largest first)
                } else if (columnKey === 'วันที่แจ้งโอนเงิน') {
                    currentSortDirection = 'desc'; // Default for date is descending (newest first)
                }
                else {
                    currentSortDirection = 'asc'; // Default for other text columns (like name, occupation) is ascending (A-Z)
                }
            }

            filteredDonorsData.sort((a, b) => {
                let valA = a[columnKey];
                let valB = b[columnKey];

                if (columnKey === 'จำนวนเงิน') {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                    return currentSortDirection === 'asc' ? valA - valB : valB - valA;
                } else if (columnKey === 'วันที่แจ้งโอนเงิน') {
                    // Combine date and time for accurate chronological sorting
                    const dateTimeA = new Date(`${a['วันที่แจ้งโอนเงิน'] || '1970-01-01'}T${a['เวลาแจ้งโอนเงิน'] || '00:00:00'}`);
                    const dateTimeB = new Date(`${b['วันที่แจ้งโอนเงิน'] || '1970-01-01'}T${b['เวลาแจ้งโอนเงิน'] || '00:00:00'}`);
                    return currentSortDirection === 'asc' ? dateTimeA.getTime() - dateTimeB.getTime() : dateTimeB.getTime() - dateTimeA.getTime();
                } else { // Default to string comparison for other columns like 'ชื่อ-นามสกุล' and 'รุ่น/อาชีพ'
                    const stringA = String(valA || '').toLowerCase();
                    const stringB = String(valB || '').toLowerCase();
                    return currentSortDirection === 'asc' ? stringA.localeCompare(stringB) : stringB.localeCompare(stringA);
                }
            });
            currentPage = 1; // Reset to first page after sorting
            renderTable(filteredDonorsData);
        }

        /**
         * Renders the donor data into the table and updates summary and pagination controls.
         * @param {Array} donors - Array of donor objects (can be filtered or all data).
         */
        function renderTable(donors) {
            if (!Array.isArray(donors)) {
                console.error("renderTable received non-array data:", donors);
                donorsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">ไม่สามารถแสดงข้อมูลได้เนื่องจากข้อมูลไม่ถูกต้อง</td></tr>';
                totalAmountSpan.textContent = '0';
                totalDonorsSpan.textContent = '0';
                paginationButtonsContainer.innerHTML = '';
                return;
            }
            
            const totalPages = Math.ceil(donors.length / itemsPerPage);

            if (currentPage < 1) currentPage = 1;
            if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
            if (totalPages === 0) currentPage = 0;

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedDonors = donors.slice(startIndex, endIndex);

            // Update sort icons in table headers
            document.querySelectorAll('.table thead th').forEach(th => {
                const sortIcon = th.querySelector('.sort-icon');
                if (sortIcon) {
                    sortIcon.textContent = ''; // Clear existing icon
                }
                const sortKey = th.getAttribute('data-sort-key');
                if (sortKey === currentSortColumn) {
                    if (sortIcon) {
                        sortIcon.textContent = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
                    }
                }
            });

            // Show appropriate message if no data is found for the current view
            if (paginatedDonors.length === 0) {
                let messageContent = '';
                // If there's a search term and no results in the filtered data
                if (searchInput.value.trim() !== '') {
                    messageContent = 'ไม่พบข้อมูลผู้บริจาคที่ตรงกับคำค้นหา';
                    donorsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-info py-4">${messageContent}</td></tr>`;
                } else {
                    // This handles the case where there's no search term and no data (sheet is empty).
                    // As per user's request: "ไม่มีข้อมูล" to be shown
                    messageContent = 'ไม่มีข้อมูล'; 
                    donorsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-info py-4">${messageContent}</td></tr>`;
                }
            } else {
                // Clear the loading message or previous content ONLY when actual data is about to be rendered
                donorsTableBody.innerHTML = ''; 
                paginatedDonors.forEach((donor, index) => {
                    const row = donorsTableBody.insertRow(); 
                    row.insertCell(0).textContent = startIndex + index + 1;
                    row.insertCell(1).textContent = donor['ชื่อ-นามสกุล'] || '-';
                    row.insertCell(2).textContent = donor['รุ่น/อาชีพ'] || '-';
                    row.insertCell(3).textContent = parseFloat(donor['จำนวนเงิน']).toLocaleString('th-TH') || '0';
                    // Format the date to show Thai month name abbreviation
                    row.insertCell(4).textContent = donor['วันที่แจ้งโอนเงิน'] ? 
                        new Date(donor['วันที่แจ้งโอนเงิน']).toLocaleDateString('th-TH', { 
                            day: 'numeric', 
                            month: 'short', // Changed to 'short' for abbreviation
                            year: 'numeric' 
                        }) : '-';
                });
            }

            // Calculate overall totals from the FULL UNFILTERED DATA (allDonorsData)
            const totalAmount = allDonorsData.reduce((sum, donor) => sum + (parseFloat(donor['จำนวนเงิน']) || 0), 0);
            const donorCount = allDonorsData.length;

            totalAmountSpan.textContent = totalAmount.toLocaleString('th-TH');
            totalDonorsSpan.textContent = donorCount;

            // Update pagination controls (number buttons)
            paginationButtonsContainer.innerHTML = '';

            if (totalPages > 0) {
                const createButton = (page, text, disabled = false, isActive = false) => {
                    const button = document.createElement('button');
                    button.textContent = text;
                    button.classList.add('pagination-btn');
                    if (isActive) button.classList.add('active');
                    if (disabled) button.disabled = true;
                    button.addEventListener('click', () => {
                        currentPage = page;
                        renderTable(donors);
                    });
                    return button;
                };

                const prevButton = createButton(currentPage - 1, '« หน้าก่อนหน้า', currentPage === 1);
                paginationButtonsContainer.appendChild(prevButton);

                const startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
                const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

                if (startPage > 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.classList.add('pagination-ellipsis');
                    paginationButtonsContainer.appendChild(ellipsis);
                }

                for (let i = startPage; i <= endPage; i++) {
                    paginationButtonsContainer.appendChild(createButton(i, i.toString(), false, i === currentPage));
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        const ellipsis = document.createElement('span');
                        ellipsis.textContent = '...';
                        ellipsis.classList.add('pagination-ellipsis');
                        paginationButtonsContainer.appendChild(ellipsis);
                    }
                    paginationButtonsContainer.appendChild(createButton(totalPages, totalPages.toString()));
                }

                const nextButton = createButton(currentPage + 1, 'หน้าถัดไป »', currentPage === totalPages);
                paginationButtonsContainer.appendChild(nextButton);
            }
        }

        /**
         * Filters the donor data based on search input and selected category, then renders the first page of results.
         */
        function filterDonors() {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const category = searchCategory.value; // Get selected category

            filteredDonorsData = allDonorsData.filter(donor => {
                const fullName = String(donor['ชื่อ-นามสกุล'] || '').toLowerCase();
                const rawTransferDate = String(donor['วันที่แจ้งโอนเงิน'] || '');
                let formattedTransferDate = '';
                try {
                    if (rawTransferDate) {
                        const dateObj = new Date(rawTransferDate);
                        if (!isNaN(dateObj.getTime())) {
                            // Use same formatting as in renderTable for consistency
                            formattedTransferDate = dateObj.toLocaleDateString('th-TH', { 
                                day: 'numeric', 
                                month: 'short', // Changed to 'short' for abbreviation
                                year: 'numeric' 
                            }).toLowerCase();
                        }
                    }
                } catch (e) {
                    console.error("Error formatting date for search:", e);
                }
                const transferTime = String(donor['เวลาแจ้งโอนเงิน'] || '').toLowerCase();
                const amount = String(donor['จำนวนเงิน'] || '');
                const occupation = String(donor['รุ่น/อาชีพ'] || '').toLowerCase();

                if (searchTerm === '') {
                    return true; // If search term is empty, show all (filtered) data
                }

                switch (category) {
                    case 'fullName':
                        return fullName.includes(searchTerm);
                    case 'transferDate':
                        return rawTransferDate.includes(searchTerm) || formattedTransferDate.includes(searchTerm);
                    case 'amount':
                        return amount.includes(searchTerm);
                    case 'occupation':
                        return occupation.includes(searchTerm);
                    case 'all':
                    default:
                        return fullName.includes(searchTerm) ||
                               rawTransferDate.includes(searchTerm) ||
                               formattedTransferDate.includes(searchTerm) ||
                               transferTime.includes(searchTerm) ||
                               amount.includes(searchTerm) ||
                               occupation.includes(searchTerm);
                }
            });
            currentPage = 1; // Reset to first page when filtering
            // Apply current sorting preference after filtering
            sortTable(currentSortColumn);
        }

        // Event Listeners
        showDonationFormBtn.addEventListener('click', () => {
            donationForm.reset(); // Clear form on opening
            setCurrentTransferDateTime(); // Set current date and time when opening the form
            showPage(donationFormPage);
        });

        backToHomeBtn.addEventListener('click', () => {
            showPage(homePage);
            // Immediately fetch data and re-render the table upon returning
            fetchDonors(3).then(data => { 
                allDonorsData = data;
                filteredDonorsData = [...allDonorsData];
                sortTable(currentSortColumn); // This will also call renderTable
            });
        });

        searchInput.addEventListener('keyup', filterDonors);
        searchCategory.addEventListener('change', () => {
            // Update placeholder based on selected category
            const selectedOptionText = searchCategory.options[searchCategory.selectedIndex].textContent;
            searchInput.placeholder = `กรอกคำค้นหา: ${selectedOptionText.replace('ค้นหา: ', '')}...`;
            filterDonors(); // Re-filter when category changes
        });

        // Add event listeners for table headers
        headerFullName.addEventListener('click', () => sortTable('ชื่อ-นามสกุล'));
        headerOccupation.addEventListener('click', () => sortTable('รุ่น/อาชีพ')); // Added event listener for Occupation
        headerAmount.addEventListener('click', () => sortTable('จำนวนเงิน'));
        headerTransferDate.addEventListener('click', () => sortTable('วันที่แจ้งโอนเงิน'));

        donationForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Show loading alert (modal) for saving
            showAppAlert('กำลังบันทึกข้อมูล...', 'info', 'modal', true, 5000);

            // Get current date and time for transferDate and transferTime
            // These values are already set in the readonly inputs, but we'll re-get them to be safe
            const currentDateTime = getCurrentDateTime();
            const transferDate = currentDateTime.date;
            const transferTime = currentDateTime.time;

            const fullName = document.getElementById('fullName').value;
            const occupation = document.getElementById('occupation').value;
            const phoneNumber = document.getElementById('phoneNumber').value;
            const amount = document.getElementById('amount').value;
            const donationDate = document.getElementById('donationDate').value;
            const slipImageInput = document.getElementById('slipImage');
            const slipFile = slipImageInput.files[0];

            if (!slipFile) {
                Swal.close();
                showAppAlert('กรุณาแนบสลิปโอนเงิน', 'error', 'modal');
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(slipFile);

            reader.onload = async () => {
                const base64Image = reader.result.split(',')[1];
                const mimeType = slipFile.type;
                const fileName = slipFile.name;

                const params = new URLSearchParams();
                params.append('action', 'addDonation');
                params.append('transferDate', transferDate); // Use the dynamically set transfer date
                params.append('transferTime', transferTime); // Use the dynamically set transfer time
                params.append('fullName', fullName);
                params.append('occupation', occupation);
                params.append('phoneNumber', phoneNumber);
                params.append('amount', amount);
                params.append('donationDate', donationDate);
                params.append('base64Image', base64Image);
                params.append('mimeType', mimeType);
                params.append('fileName', fileName);

                const options = {
                    method: 'POST',
                    body: params.toString(),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                };

                // For debugging: log the URL and parameters before fetching
                console.log("APPS_SCRIPT_URL:", APPS_SCRIPT_URL);
                console.log("Request parameters:", Object.fromEntries(params.entries()));


                let success = false;
                for (let i = 0; i < 3; i++) {
                    try {
                        const response = await fetch(APPS_SCRIPT_URL, options);
                        console.log('Submit Form Response Status:', response.status);
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('Submit Form HTTP Error Response Text:', errorText);
                            if (response.status === 403) {
                                throw new Error('การเข้าถึงถูกปฏิเสธ: กรุณาตรวจสอบการตั้งค่าการเข้าถึง Apps Script (Who has access to the app ควรเป็น Anyone)');
                            }
                            throw new Error(`HTTP error! status: ${response.status} ${response.statusText || ''} - ${errorText.substring(0, 100)}...`);
                        }
                        const result = await response.json();

                        if (result.status === 'success') {
                            Swal.close(); // ปิด loading alert (modal) ทันที
                            
                            // เปลี่ยนหน้ากลับไปหน้าหลักทันที
                            showPage(homePage);

                            // แสดง SweetAlert2 modal success alert (จะปิดตัวเองใน 2 วินาที)
                            showAppAlert('บันทึกข้อมูลเรียบร้อยแล้ว กำลังกลับไปหน้าหลัก', 'success', 'modal', false, 2000);
                            
                            // ดำเนินการส่วนที่เหลือในเบื้องหลัง
                            donationForm.reset(); // Clear form fields
                            const updatedData = await fetchDonors(3); // Fetch updated data
                            allDonorsData = updatedData;
                            filteredDonorsData = [...allDonorsData];
                            currentPage = 1;
                            // Reapply current sort after new data is added
                            sortTable(currentSortColumn); // This will also call renderTable
                            
                            success = true;
                            break; // Exit the retry loop as success
                        } else {
                            throw new Error(result.message || 'บันทึกข้อมูลไม่สำเร็จ');
                        }
                    } catch (error) {
                        console.error('Error during form submission attempt', i + 1, ':', error);
                        if (i < 2) {
                            const delay = Math.pow(2, i) * 1000;
                            await new Promise(res => setTimeout(res, delay));
                            console.log(`Retrying form submission... Attempt ${i + 2}`);
                        } else {
                            Swal.close();
                            const errorMessage = error.message.includes('การเข้าถึงถูกปฏิเสธ') ? error.message : `เกิดข้อผิดพลาดในการบันทึก: ${error.message} กรุณาลองใหม่อีกครั้ง`;
                            showAppAlert(errorMessage, 'error', 'modal');
                        }
                    }
                }
            };

            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                Swal.close();
                showAppAlert('ไม่สามารถอ่านไฟล์รูปภาพได้', 'error', 'modal');
            };
        });

        // Initial load and periodic refresh setup
        document.addEventListener('DOMContentLoaded', () => {
            // Clear any existing interval to prevent multiple intervals running
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
            }

            // Display loading message immediately in the table itself
            donorsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-info py-4"><div class="spinner-border text-info spinner-border-sm me-2" role="status"><span class="visually-hidden">Loading...</span></div>กำลังโหลดข้อมูลผู้บริจาค...</td></tr>';
            
            // Initial data fetch
            fetchDonors(3).then(data => { 
                allDonorsData = data;
                filteredDonorsData = [...allDonorsData];
                // Apply initial sort order (latest first for date/time)
                sortTable(currentSortColumn); // This will also call renderTable
            });

            donationFormPage.classList.add('d-none');
            // Set initial placeholder for search input
            searchCategory.dispatchEvent(new Event('change'));

            // Set up periodic refresh
            refreshIntervalId = setInterval(async () => {
                console.log("Refreshing data...");
                const newData = await fetchDonors(3); // Fetch with retries
                // Only update if data has actually changed
                if (JSON.stringify(newData) !== JSON.stringify(allDonorsData)) { 
                    allDonorsData = newData;
                    // Reapply current filter and sort
                    filterDonors(); // filterDonors calls sortTable which calls renderTable
                } else {
                    console.log("Data unchanged, skipping re-render.");
                }
            }, 3000); // Refresh every 2 seconds (2000 milliseconds)
        });
