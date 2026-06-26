// Budgethor - Budgeting Application

// DOM Elements
const transactionsTab = document.getElementById("transactionsTab");
const scheduleTab = document.getElementById("scheduleTab");
const projectionsTab = document.getElementById("projectionsTab");
const transactionsSection = document.getElementById("transactionsSection");
const scheduleSection = document.getElementById("scheduleSection");
const projectionsSection = document.getElementById("projectionsSection");
const csvUpload = document.getElementById("csvUpload");
const importBtn = document.getElementById("importBtn");
const transactionsTableBody = document.querySelector("#transactionsTable tbody");
const scheduleForm = document.getElementById("scheduleForm");
const schedulesTableContainer = document.getElementById("schedulesTableContainer");
const scheduleSubmitBtn = document.getElementById("scheduleSubmitBtn");
const cancelEditScheduleBtn = document.getElementById("cancelEditScheduleBtn");
const exportSchedulesCsvBtn = document.getElementById("exportSchedulesCsvBtn");
const exportSchedulesJsonBtn = document.getElementById("exportSchedulesJsonBtn");
const importSchedulesJsonBtn = document.getElementById("importSchedulesJsonBtn");
const scheduleJsonUpload = document.getElementById("scheduleJsonUpload");
const projectionStartDate = document.getElementById("projectionStartDate");
const projectionMonths = document.getElementById("projectionMonths");
const generateProjectionBtn = document.getElementById("generateProjectionBtn");
const exportProjectionsJsonBtn = document.getElementById("exportProjectionsJsonBtn");
const importProjectionsJsonBtn = document.getElementById("importProjectionsJsonBtn");
const exportProjectionsCsvBtn = document.getElementById("exportProjectionsCsvBtn");
const importProjectionsCsvBtn = document.getElementById("importProjectionsCsvBtn");
const projectionJsonUpload = document.getElementById("projectionJsonUpload");
const projectionCsvUpload = document.getElementById("projectionCsvUpload");
const projectionResult = document.getElementById("projectionResult");

// Data storage keys
const TRANSACTIONS_KEY = "budgethor_transactions";
const SCHEDULES_KEY = "budgethor_schedules";
const PROJECTION_SETTINGS_KEY = "budgethor_projection_settings";
const PROJECTIONS_KEY = "budgethor_projections";
const DEFAULT_SCHEDULES_URL = "json/budgethor-schedule.json";
const ACCESSIBLE_COLORS = {
    positive: "#166534",
    negative: "#991b1b",
    warning: "#92400e"
};

// Initialize data from localStorage or set defaults
let transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)) || [];
let schedules = JSON.parse(localStorage.getItem(SCHEDULES_KEY)) || [];
let projectionSettings = JSON.parse(localStorage.getItem(PROJECTION_SETTINGS_KEY)) || {};
let currentProjectionData = JSON.parse(localStorage.getItem(PROJECTIONS_KEY)) || [];
currentProjectionData = hydrateProjectionRows(currentProjectionData);
let editingScheduleId = null;

// Tab switching
transactionsTab.addEventListener("click", () => {
    switchTab("transactions");
});
scheduleTab.addEventListener("click", () => {
    switchTab("schedule");
});
projectionsTab.addEventListener("click", () => {
    switchTab("projections");
});

function switchTab(tabName) {
    [transactionsTab, scheduleTab, projectionsTab].forEach(btn => {
        btn.classList.remove("active");
    });
    switch (tabName) {
        case "transactions":
            transactionsTab.classList.add("active");
            break;
        case "schedule":
            scheduleTab.classList.add("active");
            break;
        case "projections":
            projectionsTab.classList.add("active");
            break;
    }
    [transactionsSection, scheduleSection, projectionsSection].forEach(section => {
        section.classList.remove("active");
    });
    switch (tabName) {
        case "transactions":
            transactionsSection.classList.add("active");
            break;
        case "schedule":
            scheduleSection.classList.add("active");
            break;
        case "projections":
            projectionsSection.classList.add("active");
            break;
    }
    if (tabName === "transactions") {
        renderTransactions();
    } else if (tabName === "schedule") {
        renderSchedules();
    }
}

// CSV Import
importBtn.addEventListener("click", () => {
    const files = csvUpload.files;
    if (files.length === 0) {
        alert("Please select at least one CSV file to import.");
        return;
    }
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const csvContent = e.target.result;
            const newTransactions = parseCSV(csvContent, file.name);
            addTransactions(newTransactions);
        };
        reader.readAsText(file);
    });
    csvUpload.value = "";
});

function parseCSV(csvContent, sourceAccount) {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) return [];
    const header = parseCSVLine(lines[0]).map(h => normalizeHeader(h));
    const dataLines = lines.slice(1);
    const importedTransactions = [];
    dataLines.forEach(line => {
        const values = parseCSVLine(line);
        if (values.length === 0) return;
        const obj = {};
        header.forEach((key, index) => {
            obj[key] = (values[index] || "").trim();
        });
        const mappedDate =
            obj.date ||
            obj["transaction date"] ||
            obj["posted date"] ||
            obj["posting date"] ||
            obj["trans date"] ||
            obj["effective date"] ||
            "";
        const mappedDescription =
            obj.description ||
            obj.desc ||
            obj.payee ||
            obj.memo ||
            obj.name ||
            obj.merchant ||
            obj.details ||
            "";
        const mappedAccount =
            obj.account ||
            obj["account name"] ||
            sourceAccount.replace(/\.csv$/i, "");
        const amount = getTransactionAmount(obj);
        if (!mappedDate || !mappedDescription || isNaN(amount)) {
            console.warn("Skipped CSV row because date, description, or amount could not be read:", obj);
            return;
        }
        importedTransactions.push({
            id: generateId(),
            date: normalizeDateValue(mappedDate),
            description: mappedDescription,
            amount: amount,
            account: mappedAccount,
            source: sourceAccount
        });
    });
    return importedTransactions;
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^"|"$/g, "")
        .replace(/\s+/g, " ");
}

function normalizeDateValue(value) {
    const raw = String(value || "").trim();
    const parsed = new Date(raw);
    if (!isNaN(parsed)) {
        return parsed.toISOString().split("T")[0];
    }
    return raw;
}

function parseMoney(value) {
    if (value === undefined || value === null) return NaN;
    const cleaned = String(value)
        .replace(/\$/g, "")
        .replace(/,/g, "")
        .replace(/\s/g, "")
        .replace(/^\((.*)\)$/, "-$1");
    if (cleaned === "") return NaN;
    return parseFloat(cleaned);
}

function getTransactionAmount(obj) {
    const directAmount =
        obj.amount ||
        obj["transaction amount"] ||
        obj["net amount"] ||
        obj.value ||
        "";
    const parsedDirectAmount = parseMoney(directAmount);
    if (!isNaN(parsedDirectAmount)) {
        return parsedDirectAmount;
    }
    const debit = parseMoney(obj.debit || obj.withdrawal || obj.withdrawals || obj.charge || obj.charges || "");
    const credit = parseMoney(obj.credit || obj.deposit || obj.deposits || obj.payment || obj.payments || "");
    if (!isNaN(debit) || !isNaN(credit)) {
        return (isNaN(credit) ? 0 : credit) - (isNaN(debit) ? 0 : debit);
    }
    return NaN;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function addTransactions(newTransactions) {
    const existingKeys = new Set();
    transactions.forEach(t => {
        const key = t.date + "|" + t.description + "|" + t.amount + "|" + t.account;
        existingKeys.add(key);
    });
    const uniqueNewTransactions = newTransactions.filter(t => {
        const key = t.date + "|" + t.description + "|" + t.amount + "|" + t.account;
        if (!existingKeys.has(key)) {
            existingKeys.add(key);
            return true;
        }
        return false;
    });
    transactions.push(...uniqueNewTransactions);
    saveTransactions();
    renderTransactions();
    alert("Imported " + uniqueNewTransactions.length + " new transactions. " + (newTransactions.length - uniqueNewTransactions.length) + " duplicates were skipped.");
}

function saveTransactions() {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function renderTransactions() {
    transactionsTableBody.innerHTML = "";
    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    sortedTransactions.forEach(t => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        dateCell.textContent = t.date;
        row.appendChild(dateCell);
        const descCell = document.createElement("td");
        descCell.textContent = t.description;
        row.appendChild(descCell);
        const amountCell = document.createElement("td");
        amountCell.textContent = t.amount.toFixed(2);
        if (t.amount < 0) {
            amountCell.classList.add("amount-negative");
        } else {
            amountCell.classList.add("amount-positive");
        }
        row.appendChild(amountCell);
        const accountCell = document.createElement("td");
        accountCell.textContent = t.account;
        row.appendChild(accountCell);
        const idCell = document.createElement("td");
        idCell.textContent = t.id;
        row.appendChild(idCell);
        transactionsTableBody.appendChild(row);
    });
}

scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const startDate = document.getElementById("scheduleDate").value;
    const description = document.getElementById("scheduleDescription").value;
    const amount = parseFloat(document.getElementById("scheduleAmount").value);
    const frequency = document.getElementById("scheduleFrequency").value;
    const endDate = document.getElementById("scheduleEndDate").value || null;
    if (!startDate || !description || isNaN(amount)) {
        alert("Please fill in all required fields.");
        return;
    }
    if (editingScheduleId) {
        schedules = schedules.map(schedule => {
            if (schedule.id !== editingScheduleId) return schedule;
            return {
                ...schedule,
                startDate,
                description,
                amount,
                frequency,
                endDate
            };
        });
    } else {
        schedules.push({
            id: generateId(),
            startDate,
            description,
            amount,
            frequency,
            endDate
        });
    }
    saveSchedules();
    renderSchedules();
    resetScheduleForm();
});

cancelEditScheduleBtn.addEventListener("click", () => {
    resetScheduleForm();
});

exportSchedulesCsvBtn.addEventListener("click", () => {
    exportSchedulesCsv();
});

exportSchedulesJsonBtn.addEventListener("click", () => {
    exportSchedulesJson();
});

importSchedulesJsonBtn.addEventListener("click", () => {
    scheduleJsonUpload.click();
});

scheduleJsonUpload.addEventListener("change", () => {
    importSchedulesJson(scheduleJsonUpload.files[0]);
    scheduleJsonUpload.value = "";
});

function resetScheduleForm() {
    scheduleForm.reset();
    editingScheduleId = null;
    scheduleSubmitBtn.textContent = "Add Schedule";
    cancelEditScheduleBtn.style.display = "none";
}

function editSchedule(scheduleId) {
    const schedule = schedules.find(item => item.id === scheduleId);
    if (!schedule) return;
    editingScheduleId = schedule.id;
    document.getElementById("scheduleDate").value = schedule.startDate || "";
    document.getElementById("scheduleDescription").value = schedule.description || "";
    document.getElementById("scheduleAmount").value = schedule.amount;
    document.getElementById("scheduleFrequency").value = schedule.frequency || "monthly";
    document.getElementById("scheduleEndDate").value = schedule.endDate || "";
    scheduleSubmitBtn.textContent = "Update Schedule";
    cancelEditScheduleBtn.style.display = "block";
    scheduleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteSchedule(scheduleId) {
    if (!confirm("Delete this recurring item?")) return;
    schedules = schedules.filter(schedule => schedule.id !== scheduleId);
    saveSchedules();
    if (editingScheduleId === scheduleId) {
        resetScheduleForm();
    }
    renderSchedules();
}

function saveSchedules() {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
}

function renderSchedules() {
    schedulesTableContainer.innerHTML = "";
    if (schedules.length === 0) {
        schedulesTableContainer.innerHTML = "<p>No scheduled transactions.</p>";
        return;
    }
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Start Date", "Description", "Amount", "Frequency", "End Date", "Actions"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    schedules
        .slice()
        .sort((a, b) => {
            const dateDiff = new Date(a.startDate) - new Date(b.startDate);
            if (dateDiff !== 0) return dateDiff;
            return String(a.description || "").localeCompare(String(b.description || ""));
        })
        .forEach(schedule => {
            const row = document.createElement("tr");
            [
                schedule.startDate || "",
                schedule.description || "",
                formatAmount(Number(schedule.amount) || 0),
                formatFrequency(schedule.frequency),
                schedule.endDate || ""
            ].forEach(value => {
                const td = document.createElement("td");
                td.textContent = value;
                row.appendChild(td);
            });
            const actionsCell = document.createElement("td");
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.className = "small-button edit-button";
            editBtn.type = "button";
            editBtn.addEventListener("click", () => editSchedule(schedule.id));
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "small-button delete-button";
            deleteBtn.type = "button";
            deleteBtn.style.marginLeft = "6px";
            deleteBtn.addEventListener("click", () => deleteSchedule(schedule.id));
            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });
    table.appendChild(tbody);
    schedulesTableContainer.appendChild(table);
}

function formatFrequency(frequency) {
    const labels = {
        daily: "Daily",
        weekly: "Weekly",
        biweekly: "Bi-weekly",
        monthly: "Monthly",
        yearly: "Yearly"
    };
    return labels[frequency] || frequency || "";
}

function exportSchedulesJson() {
    if (schedules.length === 0) {
        alert("There are no recurring items to export.");
        return;
    }
    downloadTextFile(
        JSON.stringify(schedules, null, 2),
        "budgethor-schedule.json",
        "application/json;charset=utf-8;"
    );
}

function importSchedulesJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target.result);
            const incoming = Array.isArray(parsed) ? parsed : parsed.schedules;
            if (!Array.isArray(incoming)) {
                throw new Error("JSON must be an array of schedules or an object with a schedules array.");
            }
            schedules = incoming.map(normalizeSchedule).filter(Boolean);
            saveSchedules();
            renderSchedules();
            resetScheduleForm();
            alert("Imported " + schedules.length + " scheduled transactions.");
        } catch (error) {
            alert("Could not import schedule JSON: " + error.message);
        }
    };
    reader.readAsText(file);
}

function normalizeSchedule(item) {
    if (!item || typeof item !== "object") return null;
    const startDate = normalizeDateValue(item.startDate || item.date || "");
    const description = String(item.description || item.name || "").trim();
    const amount = parseFloat(item.amount);
    const frequency = String(item.frequency || "monthly").toLowerCase();
    const endDate = item.endDate ? normalizeDateValue(item.endDate) : null;
    if (!startDate || !description || isNaN(amount)) return null;
    return {
        id: item.id || generateId(),
        startDate,
        description,
        amount,
        frequency,
        endDate
    };
}

function exportSchedulesCsv() {
    if (schedules.length === 0) {
        alert("There are no recurring items to export.");
        return;
    }
    const headers = ["id", "startDate", "description", "amount", "frequency", "endDate"];
    const rows = schedules
        .slice()
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .map(schedule => headers.map(header => csvEscape(schedule[header] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\r\n");
    downloadTextFile(csv, "budgethor-recurring-items.csv", "text/csv;charset=utf-8;");
}

function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

generateProjectionBtn.addEventListener("click", () => {
    const projectionData = generateAndSaveProjection();
    if (projectionData.length) {
        renderProjectionResults(projectionData);
        projectionResult.style.display = "block";
    }
});

projectionStartDate.addEventListener("change", saveProjectionSettings);
projectionMonths.addEventListener("input", saveProjectionSettings);

exportProjectionsJsonBtn.addEventListener("click", () => exportProjectionsJson());
exportProjectionsCsvBtn.addEventListener("click", () => exportProjectionsCsv());

importProjectionsJsonBtn.addEventListener("click", () => projectionJsonUpload.click());
projectionJsonUpload.addEventListener("change", () => {
    importProjectionsJson(projectionJsonUpload.files[0]);
    projectionJsonUpload.value = "";
});

importProjectionsCsvBtn.addEventListener("click", () => projectionCsvUpload.click());
projectionCsvUpload.addEventListener("change", () => {
    importProjectionsCsv(projectionCsvUpload.files[0]);
    projectionCsvUpload.value = "";
});

function generateAndSaveProjection() {
    const startDate = parseLocalDate(projectionStartDate.value) || new Date();
    const monthsToProject = parseInt(projectionMonths.value) || 12;
    if (isNaN(monthsToProject) || monthsToProject <= 0) {
        alert("Please enter a valid number of months.");
        return [];
    }
    saveProjectionSettings();
    currentProjectionData = generateProjection(startDate, monthsToProject);
    saveProjections();
    return currentProjectionData;
}

function saveProjectionSettings() {
    projectionSettings = {
        startDate: projectionStartDate.value || "",
        months: parseInt(projectionMonths.value) || 12
    };
    localStorage.setItem(PROJECTION_SETTINGS_KEY, JSON.stringify(projectionSettings));
}

function saveProjections() {
    localStorage.setItem(PROJECTIONS_KEY, JSON.stringify(serializeProjectionRows(currentProjectionData)));
}

function exportProjectionsJson() {
    const data = getProjectionDataForExport();
    if (data.length === 0) return;
    downloadTextFile(
        JSON.stringify({ settings: projectionSettings, projections: serializeProjectionRows(data) }, null, 2),
        "budgethor-projections.json",
        "application/json;charset=utf-8;"
    );
}

function exportProjectionsCsv() {
    const data = getProjectionDataForExport();
    if (data.length === 0) return;
    const headers = ["date", "description", "type", "account", "amount", "balance"];
    const rows = data.map(row => [
        toDateInputValue(row.date),
        row.description,
        row.type,
        row.account,
        row.amount,
        row.balance
    ].map(csvEscape).join(","));
    downloadTextFile([headers.join(","), ...rows].join("\r\n"), "budgethor-projections.csv", "text/csv;charset=utf-8;");
}

function getProjectionDataForExport() {
    if (!currentProjectionData || currentProjectionData.length === 0) {
        currentProjectionData = generateAndSaveProjection();
    }
    if (!currentProjectionData || currentProjectionData.length === 0) {
        alert("There are no projections to export.");
        return [];
    }
    return currentProjectionData;
}

function importProjectionsJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target.result);
            const incoming = Array.isArray(parsed) ? parsed : parsed.projections;
            if (!Array.isArray(incoming)) {
                throw new Error("JSON must be an array of projections or an object with a projections array.");
            }
            currentProjectionData = hydrateProjectionRows(incoming);
            if (parsed.settings) {
                projectionSettings = parsed.settings;
                projectionStartDate.value = projectionSettings.startDate || projectionStartDate.value;
                projectionMonths.value = projectionSettings.months || projectionMonths.value;
                saveProjectionSettings();
            }
            saveProjections();
            renderProjectionResults(currentProjectionData);
            projectionResult.style.display = "block";
            alert("Imported " + currentProjectionData.length + " projection rows.");
        } catch (error) {
            alert("Could not import projection JSON: " + error.message);
        }
    };
    reader.readAsText(file);
}

function importProjectionsCsv(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const lines = event.target.result.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) throw new Error("CSV must include a header row and at least one projection row.");
            const headers = parseCSVLine(lines[0]).map(normalizeHeader);
            const rows = lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const obj = {};
                headers.forEach((header, index) => obj[header] = values[index] || "");
                return obj;
            });
            currentProjectionData = hydrateProjectionRows(rows);
            saveProjections();
            renderProjectionResults(currentProjectionData);
            projectionResult.style.display = "block";
            alert("Imported " + currentProjectionData.length + " projection rows.");
        } catch (error) {
            alert("Could not import projection CSV: " + error.message);
        }
    };
    reader.readAsText(file);
}

function generateProjection(startDate, monthsToProject) {
    const projectionEndDate = addMonths(startDate, monthsToProject);
    let balance = 0;
    transactions.forEach(t => {
        const tDate = parseTransactionDate(t.date);
        if (tDate && tDate < startDate) {
            balance += Number(t.amount) || 0;
        }
    });
    const rows = [{
        date: new Date(startDate),
        label: "Starting Balance",
        description: "Starting Balance",
        amount: 0,
        type: "Balance",
        account: "",
        balance: balance
    }];
    const projectedTransactions = [
        ...getActualTransactionsForRange(startDate, projectionEndDate),
        ...getScheduledTransactionsForRange(startDate, projectionEndDate)
    ].sort((a, b) => {
        const dateDiff = a.date - b.date;
        if (dateDiff !== 0) return dateDiff;
        return a.description.localeCompare(b.description);
    });
    projectedTransactions.forEach(item => {
        balance += item.amount;
        rows.push({
            date: new Date(item.date),
            label: formatDateLabel(item.date),
            description: item.description,
            amount: item.amount,
            type: item.type,
            account: item.account,
            balance: balance
        });
    });
    return rows;
}

function getActualTransactionsForRange(rangeStart, rangeEnd) {
    return transactions
        .map(t => ({
            date: parseTransactionDate(t.date),
            description: t.description || "(No description)",
            amount: Number(t.amount) || 0,
            account: t.account || "",
            type: "Actual"
        }))
        .filter(t => t.date && t.date >= rangeStart && t.date < rangeEnd);
}

function getScheduledTransactionsForRange(rangeStart, rangeEnd) {
    const items = [];
    schedules.forEach(schedule => {
        const scheduleStart = parseLocalDate(schedule.startDate);
        const scheduleEnd = schedule.endDate ? parseLocalDate(schedule.endDate) : null;
        if (!scheduleStart) return;
        if (scheduleEnd && scheduleEnd < rangeStart) return;
        if (scheduleStart >= rangeEnd) return;
        let current = new Date(scheduleStart);
        while (getNextOccurrence(current, schedule.frequency) < rangeStart) {
            current = getNextOccurrence(current, schedule.frequency);
        }
        while (current < rangeEnd) {
            if (current >= rangeStart && (!scheduleEnd || current <= scheduleEnd)) {
                items.push({
                    date: new Date(current),
                    description: schedule.description || "(Scheduled transaction)",
                    amount: Number(schedule.amount) || 0,
                    account: "Scheduled",
                    type: "Scheduled"
                });
            }
            const next = getNextOccurrence(current, schedule.frequency);
            if (next <= current) break;
            current = next;
        }
    });
    return items;
}

function getNextOccurrence(date, frequency) {
    const next = new Date(date);
    if (frequency === "daily") {
        next.setDate(next.getDate() + 1);
    } else if (frequency === "weekly") {
        next.setDate(next.getDate() + 7);
    } else if (frequency === "biweekly") {
        next.setDate(next.getDate() + 14);
    } else if (frequency === "monthly") {
        next.setMonth(next.getMonth() + 1);
    } else if (frequency === "yearly") {
        next.setFullYear(next.getFullYear() + 1);
    } else {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

function addMonths(date, months) {
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    if (result.getDate() !== originalDay) {
        result.setDate(0);
    }
    return result;
}

function parseLocalDate(value) {
    if (!value) return null;
    const parts = String(value).split("-").map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(value);
    return isNaN(parsed) ? null : parsed;
}

function parseTransactionDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }
    const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
        let year = Number(usMatch[3]);
        if (year < 100) year += 2000;
        return new Date(year, Number(usMatch[1]) - 1, Number(usMatch[2]));
    }
    const parsed = new Date(text);
    return isNaN(parsed) ? null : parsed;
}

function hydrateProjectionRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => {
        const date = parseTransactionDate(row.date) || parseTransactionDate(row.label) || new Date();
        return {
            date,
            label: row.label || formatDateLabel(date),
            description: row.description || "",
            amount: Number(row.amount) || 0,
            type: row.type || "Imported",
            account: row.account || "",
            balance: Number(row.balance) || 0
        };
    });
}

function serializeProjectionRows(rows) {
    return (rows || []).map(row => ({
        date: toDateInputValue(row.date),
        label: row.label || formatDateLabel(row.date),
        description: row.description || "",
        amount: Number(row.amount) || 0,
        type: row.type || "",
        account: row.account || "",
        balance: Number(row.balance) || 0
    }));
}

function toDateInputValue(date) {
    const parsed = date instanceof Date ? date : parseTransactionDate(date);
    if (!parsed || isNaN(parsed)) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatDateLabel(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderProjectionResults(data) {
    projectionResult.innerHTML = "<h3>Projection Result</h3>";
    const chartCard = document.createElement("div");
    chartCard.className = "chart-card";
    const chartTitle = document.createElement("h4");
    chartTitle.textContent = "Projected Balance by Transaction";
    chartCard.appendChild(chartTitle);
    const canvas = document.createElement("canvas");
    canvas.id = "projectionCanvas";
    canvas.width = 1000;
    canvas.height = 340;
    canvas.setAttribute("aria-label", "Transaction-by-transaction projected balance line chart");
    canvas.setAttribute("role", "img");
    chartCard.appendChild(canvas);
    const note = document.createElement("p");
    note.className = "chart-note";
    note.textContent = "Blue shows projected balance by transaction. Gold shows the running average balance across the projection.";
    chartCard.appendChild(note);
    projectionResult.appendChild(chartCard);
    renderProjectionCanvas(canvas, data);
    renderProjectionTable(data);
}

function renderProjectionCanvas(canvas, data) {
    const ctx = canvas.getContext("2d");
    const chartData = data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 24, right: 32, bottom: 62, left: 88 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (chartData.length <= 1) {
        ctx.fillStyle = "#666666";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("No projected transactions found for this date range.", width / 2, height / 2);
        return;
    }
    const runningAverageData = getRunningAverageBalances(chartData);
    const balances = chartData.map(entry => entry.balance);
    const runningAverageBalances = runningAverageData.map(entry => entry.averageBalance);
    let minBalance = Math.min(...balances, ...runningAverageBalances, 0);
    let maxBalance = Math.max(...balances, ...runningAverageBalances, 0);
    if (minBalance === maxBalance) {
        minBalance -= 100;
        maxBalance += 100;
    }
    const range = maxBalance - minBalance;
    minBalance -= range * 0.1;
    maxBalance += range * 0.1;
    const xForIndex = (index) => {
        if (chartData.length === 1) return padding.left + plotWidth / 2;
        return padding.left + (index / (chartData.length - 1)) * plotWidth;
    };
    const yForBalance = (balance) => {
        return padding.top + ((maxBalance - balance) / (maxBalance - minBalance)) * plotHeight;
    };
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#555555";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const value = minBalance + ((maxBalance - minBalance) / gridLines) * i;
        const y = yForBalance(value);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.fillText(formatCurrency(value), padding.left - 10, y);
    }
    ctx.strokeStyle = "#333333";
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 4;
    ctx.beginPath();
    chartData.forEach((entry, index) => {
        const x = xForIndex(index);
        const y = yForBalance(entry.balance);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = "#f39c12";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    runningAverageData.forEach((entry, index) => {
        const x = xForIndex(index);
        const y = yForBalance(entry.averageBalance);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    const pointEvery = Math.max(1, Math.ceil(chartData.length / 150));
    chartData.forEach((entry, index) => {
        if (index % pointEvery !== 0 && index !== chartData.length - 1) return;
        const x = xForIndex(index);
        const y = yForBalance(entry.balance);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = entry.balance < 0 ? ACCESSIBLE_COLORS.negative : ACCESSIBLE_COLORS.positive;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    const labelEvery = Math.max(1, Math.ceil(chartData.length / 8));
    ctx.fillStyle = "#555555";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    chartData.forEach((entry, index) => {
        if (index % labelEvery !== 0 && index !== chartData.length - 1) return;
        const x = xForIndex(index);
        const label = entry.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        ctx.save();
        ctx.translate(x, height - padding.bottom + 28);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });
    ctx.fillStyle = "#555555";
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillText("Transaction date", width / 2, height - 8);
    ctx.save();
    ctx.translate(18, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Running balance", 0, 0);
    ctx.restore();
}

function getRunningAverageBalances(chartData) {
    let total = 0;
    return chartData.map((entry, index) => {
        total += Number(entry.balance) || 0;
        return {
            ...entry,
            averageBalance: total / (index + 1)
        };
    });
}

function drawChartLegend(ctx, width, padding, items) {
    const startX = width - padding.right - 220;
    let currentY = padding.top + 8;
    ctx.save();
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    items.forEach(item => {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.dashed ? 3 : 4;
        ctx.setLineDash(item.dashed ? [8, 5] : []);
        ctx.beginPath();
        ctx.moveTo(startX, currentY);
        ctx.lineTo(startX + 32, currentY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#333333";
        ctx.fillText(item.label, startX + 42, currentY);
        currentY += 18;
    });
    ctx.restore();
}

function formatCurrency(value) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return "$" + (value / 1000000).toFixed(1) + "M";
    if (absValue >= 1000) return "$" + (value / 1000).toFixed(1) + "K";
    return "$" + value.toFixed(0);
}

function renderProjectionTable(data) {
    const runningAverageData = getRunningAverageBalances(data);
    const container = document.createElement("div");
    container.style.overflowX = "auto";
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.marginTop = "20px";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Date", "Description", "Type", "Account", "Amount", "Running Balance"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        th.style.borderBottom = "2px solid #3498db";
        th.style.padding = "10px";
        th.textAlign = "left";
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    data.forEach((entry, rowIndex) => {
        const row = document.createElement("tr");
        const cells = [
            entry.label,
            entry.description,
            entry.type,
            entry.account,
            formatAmount(entry.amount),
            entry.balance.toFixed(2)
        ];
        cells.forEach((value, index) => {
            const td = document.createElement("td");
            td.textContent = value;
            td.style.padding = "10px";
            td.style.borderBottom = "1px solid #ddd";
            td.style.verticalAlign = "top";
            if (index === 4) {
                if (entry.amount < 0) {
                    td.classList.add("amount-negative");
                } else if (entry.amount > 0) {
                    td.classList.add("amount-positive");
                }
            }
            if (index === 5) {
                const averageBalance = runningAverageData[rowIndex]?.averageBalance ?? entry.balance;
                td.classList.add(getBalanceVsAverageClass(entry.balance, averageBalance));
            }
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    projectionResult.appendChild(container);
    container.appendChild(table);
}

function formatAmount(value) {
    if (value < 0) return "-$" + Math.abs(value).toFixed(2);
    if (value > 0) return "$" + value.toFixed(2);
    return "$0.00";
}

function getBalanceVsAverageClass(balance, averageBalance) {
    const balanceCents = Math.round((Number(balance) || 0) * 100);
    const averageCents = Math.round((Number(averageBalance) || 0) * 100);
    if (balanceCents > averageCents) return "balance-above";
    if (balanceCents === averageCents) return "balance-equal";
    return "balance-below";
}

async function loadDefaultSchedulesIfEmpty() {
    if (schedules.length > 0) return;
    try {
        const response = await fetch(DEFAULT_SCHEDULES_URL);
        if (!response.ok) throw new Error(`Failed to load default schedules (${response.status})`);
        const data = await response.json();
        if (Array.isArray(data)) {
            schedules = data.map(normalizeSchedule).filter(Boolean);
            saveSchedules();
        }
    } catch (error) {
        console.warn("Could not load default schedules:", error);
    }
}

async function init() {
    const today = new Date();
    projectionStartDate.value = projectionSettings.startDate || today.toISOString().split("T")[0];
    projectionMonths.value = projectionSettings.months || projectionMonths.value || 12;
    await loadDefaultSchedulesIfEmpty();
    renderTransactions();
    renderSchedules();
    if (currentProjectionData.length > 0) {
        renderProjectionResults(currentProjectionData);
        projectionResult.style.display = "block";
    }
    switchTab("transactions");
}

document.addEventListener("DOMContentLoaded", init);
