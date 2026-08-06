/*
  SRT Ticket Tools – Correctness Patch v5
  ใช้กับ index.html เดิม โดยวางไฟล์นี้ไว้โฟลเดอร์เดียวกัน
  และเพิ่ม <script src="booking-fix-v5.js"></script> หลัง </script> เดิม ก่อน </body>
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const OFFICIAL_DTICKET_URL = 'https://dticket.railway.co.th/DTicketPublicWeb/home/Home';
  const SPECIAL_48_HOUR_TRAIN_IDS = new Set(['997/998']);
  const SPECIAL_48_HOUR_TERMINAL_TIMES = {
    '997': { station: 'กรุงเทพ (หัวลำโพง)', time: '06:45' },
    '998': { station: 'จุกเสม็ด', time: '15:30' }
  };

  function localDateOnly(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toLocalISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(y, m - 1, d);
    if (
      result.getFullYear() !== y ||
      result.getMonth() !== m - 1 ||
      result.getDate() !== d
    ) return null;
    return result;
  }

  function formatDate(date) {
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString('th-TH', {
      minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function roundFinalBaht(value) {
    return Math.floor(Number(value) + 0.5 + 1e-9);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectPatchStyles() {
    if ($('srtPatchV4Styles')) return;
    const style = document.createElement('style');
    style.id = 'srtPatchV4Styles';
    style.textContent = `
      .patch-field{
        background:#fff;
        border:1px solid #dbeafe;
        border-radius:18px;
        padding:14px;
      }
      .patch-status{
        border-radius:16px;
        padding:12px 14px;
        margin:0 0 14px;
        font-size:13px;
        font-weight:900;
        line-height:1.55;
      }
      .patch-status.waiting{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
      .patch-status.open{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
      .patch-status.today{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
      .patch-action{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        margin-top:14px;
        padding:11px 16px;
        border-radius:14px;
        background:#0f2f5f;
        color:#fff;
        text-decoration:none;
        font-size:13px;
        font-weight:900;
        box-shadow:0 8px 18px rgba(15,47,95,.18);
      }
      .patch-action:hover{filter:brightness(1.08)}
      .patch-version{
        display:inline-flex;
        margin-left:8px;
        padding:4px 8px;
        border-radius:999px;
        background:#ecfdf5;
        color:#047857;
        border:1px solid #a7f3d0;
        font-size:10px;
        font-weight:900;
        vertical-align:middle;
      }
      .patch-small{
        margin-top:10px;
        font-size:11px;
        color:#64748b;
        font-weight:800;
        line-height:1.55;
      }
    `;
    document.head.appendChild(style);
  }

  function insertReservationTypeFields() {
    const trainManualBox = $('trainManualBox');
    if (trainManualBox && !$('stationTrainTypeBox')) {
      const wrap = document.createElement('div');
      wrap.id = 'stationTrainTypeBox';
      wrap.className = 'patch-field hidden';
      wrap.innerHTML = `
        <label for="stationTrainType">ประเภทการจำหน่ายของขบวนรถ</label>
        <select id="stationTrainType">
          <option value="">- โปรดเลือกประเภทขบวนรถ -</option>
          <option value="reserved">ขบวนสำรองที่นั่ง เช่น ด่วนพิเศษ / ด่วน / เร็ว</option>
          <option value="nonreserved">ขบวนไม่สำรองที่นั่ง เช่น ธรรมดา / ชานเมือง / ท้องถิ่น</option>
        </select>
        <div class="hint">ต้องเลือกกรณีไม่ได้ระบุหมายเลขขบวน เพื่อป้องกันระบบคำนวณวันจองผิดประเภท</div>
      `;
      trainManualBox.parentNode.insertBefore(wrap, trainManualBox);
    }

    const manualMode = $('manualMode');
    if (manualMode && !$('manualTrainTypeBox')) {
      const wrap = document.createElement('div');
      wrap.id = 'manualTrainTypeBox';
      wrap.className = 'patch-field';
      wrap.innerHTML = `
        <label for="manualTrainType">ประเภทการจำหน่ายของขบวนรถ</label>
        <select id="manualTrainType">
          <option value="">- โปรดเลือกประเภทขบวนรถ -</option>
          <option value="reserved">ขบวนสำรองที่นั่ง เช่น ด่วนพิเศษ / ด่วน / เร็ว</option>
          <option value="nonreserved">ขบวนไม่สำรองที่นั่ง เช่น ธรรมดา / ชานเมือง / ท้องถิ่น</option>
        </select>
        <div class="hint">ขบวนไม่สำรองที่นั่งไม่ใช้เกณฑ์ 1 / 30 / 90 วัน</div>
      `;
      manualMode.insertBefore(wrap, manualMode.firstChild);
    }
  }

  function getSelectedTrain() {
    const line = $('selectedLine')?.value || '';
    const trainId = $('selectedTrain')?.value || '';
    if (!line || !trainId || typeof trainSchedules === 'undefined') return null;
    return (trainSchedules[line] || []).find((train) => train.id === trainId) || null;
  }

  function getTrainReservationType(train) {
    if (!train) return null;
    const text = `${train.id || ''} ${train.name || ''}`;
    if (/(ธรรมดา|ชานเมือง|ท้องถิ่น|ที่นั่งอิสระ|non[-\s]?reserved)/i.test(text)) {
      return 'nonreserved';
    }
    return 'reserved';
  }

  function getInputMode() {
    return $('modeManual')?.classList.contains('active') ? 'manual' : 'station';
  }

  function getCurrentReservationType() {
    if (getInputMode() === 'manual') {
      return $('manualTrainType')?.value || '';
    }
    const train = getSelectedTrain();
    if (train) return getTrainReservationType(train);
    return $('stationTrainType')?.value || '';
  }

  function updateReservationTypeVisibility() {
    const box = $('stationTrainTypeBox');
    if (!box) return;
    const hasLine = Boolean($('selectedLine')?.value);
    const hasTrain = Boolean($('selectedTrain')?.value);
    box.classList.toggle('hidden', !hasLine || hasTrain);
  }

  function getKm(stationName) {
    const line = $('selectedLine')?.value || '';
    if (!line || !stationName || typeof trainData === 'undefined') return null;
    const station = (trainData[line]?.stations || []).find((item) => item.name === stationName);
    return station ? Number(station.km) : null;
  }

  function getDistances() {
    if (getInputMode() === 'manual') {
      return {
        total: Number.parseFloat($('totalDistance')?.value || ''),
        passenger: Number.parseFloat($('passengerDistance')?.value || ''),
        routeValid: true
      };
    }

    const t1 = getKm($('trainOrigin')?.value);
    const t2 = getKm($('trainDest')?.value);
    const p1 = getKm($('passOrigin')?.value);
    const p2 = getKm($('passDest')?.value);

    const total = t1 !== null && t2 !== null ? Math.abs(t2 - t1) : NaN;
    const passenger = p1 !== null && p2 !== null ? Math.abs(p2 - p1) : NaN;

    let routeValid = true;
    if ([t1, t2, p1, p2].every(Number.isFinite)) {
      const min = Math.min(t1, t2);
      const max = Math.max(t1, t2);
      routeValid = p1 >= min && p1 <= max && p2 >= min && p2 <= max;
    }

    return { total, passenger, routeValid };
  }

  function renderBookingEmpty() {
    const result = $('result');
    if (!result) return;
    result.innerHTML = `
      <div class="empty">
        <div class="big">🧮</div>
        <p>กรุณาระบุข้อมูลให้ครบถ้วน<br>เพื่อคำนวณวันจองให้อัตโนมัติ</p>
      </div>
    `;
  }

  function renderBookingError(message) {
    const result = $('result');
    if (!result) return;
    result.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
  }

  function renderNonReserved(travelDate) {
    const result = $('result');
    if (!result) return;
    result.innerHTML = `
      <div class="east">
        <div class="icon">🎫</div>
        <h3>ขบวนไม่สำรองที่นั่ง</h3>
        <p><b>รถธรรมดา / รถชานเมือง / รถท้องถิ่น หรือรถที่นั่งอิสระ</b></p>
        <div class="main">ซื้อในวันเดินทาง</div>
        <p style="font-weight:900;margin:12px 0 0;color:#9a3412">
          วันที่ ${formatDate(travelDate)} ก่อนขบวนรถออกไม่เกิน 2 ชั่วโมง
        </p>
        <div class="patch-small">
          บางสถานีหรือป้ายหยุดรถอาจมีวิธีจำหน่ายเฉพาะ โปรดตรวจสอบกับสถานีหรือสายด่วน 1690
        </div>
      </div>
    `;
  }

  function getSpecial48HourTripDetail(travelDate) {
    const origin = $('passOrigin')?.value || '';
    const destination = $('passDest')?.value || '';
    const originKm = getKm(origin);
    const destinationKm = getKm(destination);

    let trainNo = '997/998';
    if (Number.isFinite(originKm) && Number.isFinite(destinationKm)) {
      trainNo = destinationKm > originKm ? '997' : '998';
    }

    const terminalInfo = SPECIAL_48_HOUR_TERMINAL_TIMES[trainNo];
    const hasKnownDepartureTime = Boolean(
      terminalInfo &&
      origin === terminalInfo.station &&
      /^\d{2}:\d{2}$/.test(terminalInfo.time)
    );

    const saleDate = new Date(travelDate);
    saleDate.setDate(saleDate.getDate() - 2);

    let saleStart = null;
    if (hasKnownDepartureTime) {
      const [hour, minute] = terminalInfo.time.split(':').map(Number);
      saleStart = new Date(saleDate);
      saleStart.setHours(hour, minute, 0, 0);
    }

    return {
      trainNo,
      origin,
      destination,
      saleDate,
      saleStart,
      departureTime: hasKnownDepartureTime ? terminalInfo.time : null
    };
  }

  function renderSpecial48Hour(travelDate) {
    const result = $('result');
    if (!result) return;

    const detail = getSpecial48HourTripDetail(travelDate);
    const now = new Date();
    const isWeekend = [0, 6].includes(travelDate.getDay());

    let statusHtml = '';
    if (detail.saleStart) {
      if (now < detail.saleStart) {
        statusHtml = `
          <div class="patch-status waiting">
            ⏳ ยังไม่เข้าสู่ช่วงจำหน่าย 48 ชั่วโมง
          </div>
        `;
      } else {
        statusHtml = `
          <div class="patch-status open">
            ✅ เข้าสู่ช่วงจำหน่ายแล้ว — โปรดลองทำรายการใน D-Ticket หรือติดต่อสถานี
          </div>
        `;
      }
    } else {
      statusHtml = `
        <div class="patch-status waiting">
          ℹ️ ต้องตรวจเวลาขบวนออกจากสถานีขึ้น เพื่อระบุเวลาเปิดขายให้ตรง 48 ชั่วโมง
        </div>
      `;
    }

    const openingText = detail.saleStart
      ? `${formatDate(detail.saleDate)} เวลา ${detail.departureTime} น.`
      : `${formatDate(detail.saleDate)} ณ เวลาเดียวกับเวลาขบวนออกจากสถานี ${escapeHtml(detail.origin)}`;

    const weekendWarning = isWeekend
      ? ''
      : `
        <div class="warning-note">
          ตามตารางปัจจุบัน ขบวน 997/998 ให้บริการเป็นหลักในวันเสาร์–อาทิตย์
          วันเดินทางที่เลือกไม่ใช่วันเสาร์หรือวันอาทิตย์ โปรดตรวจสอบตารางเดินรถอีกครั้ง
        </div>
      `;

    result.innerHTML = `
      <div class="east">
        ${statusHtml}
        <div class="icon">⏱️</div>
        <h3>ขบวน ${detail.trainNo} ค่าโดยสารอัตราพิเศษ</h3>
        <p><b>ห้ามจำหน่ายก่อนเวลาขบวนรถออก 48 ชั่วโมง</b></p>
        <div class="main">เปิดขายภายใน 48 ชั่วโมงก่อนรถออก</div>
        <div class="datebox" style="margin-top:16px">
          <div class="label">วันและเวลาเริ่มทำรายการได้เร็วที่สุด</div>
          <div class="date">${openingText}</div>
          <div style="font-size:12px;color:#64748b;font-weight:800">
            สำหรับเดินทางวันที่ ${formatDate(travelDate)}
            จาก ${escapeHtml(detail.origin)} ไป ${escapeHtml(detail.destination)}
          </div>
        </div>
        ${weekendWarning}
        <div class="patch-small">
          เงื่อนไขนี้เป็นกฎของค่าโดยสารอัตราพิเศษ จึงไม่ใช้เกณฑ์ระยะทาง 1 / 30 / 90 วัน
          หากขึ้นจากสถานีระหว่างทาง โปรดตรวจเวลาขบวนออกจากสถานีนั้นก่อนทำรายการ
        </div>
        <a class="patch-action" href="${OFFICIAL_DTICKET_URL}" target="_blank" rel="noopener noreferrer">
          เปิดเว็บไซต์ D-Ticket
        </a>
      </div>
    `;
  }

  function renderBookingResult({ percentage, days, bookingDate, travelDate }) {
    const result = $('result');
    if (!result) return;

    const color = days === 90 ? 'green' : days === 30 ? 'blue' : 'gray';
    const now = new Date();
    const opensAt = new Date(bookingDate);
    opensAt.setHours(8, 30, 0, 0);

    let statusHtml = '';
    if (now < opensAt) {
      const today = localDateOnly(now);
      const openDay = localDateOnly(bookingDate);
      const dayDifference = Math.round((openDay - today) / DAY_MS);
      const detail = dayDifference === 0
        ? 'เริ่มเปิดจองวันนี้ เวลา 08.30 น.'
        : dayDifference === 1
          ? 'เริ่มเปิดจองพรุ่งนี้ เวลา 08.30 น.'
          : `เหลืออีกประมาณ ${dayDifference.toLocaleString('th-TH')} วันก่อนเปิดจอง`;
      statusHtml = `<div class="patch-status waiting">⏳ ยังไม่เปิดจอง — ${detail}</div>`;
    } else {
      statusHtml = `<div class="patch-status open">✅ เปิดจองแล้ว — ทั้งนี้ขึ้นอยู่กับที่นั่งว่างและเงื่อนไขของขบวนรถ</div>`;
    }

    result.innerHTML = `
      <div class="booking ${color}">
        <div class="booking-inner">
          ${statusHtml}
          <div class="pill">เดินทาง ${percentage}% ของระยะทางขบวนรถ</div>
          <div class="days ${color}">จองล่วงหน้า ${days} วัน</div>
          <div class="datebox">
            <div class="label">วันที่เริ่มจองตั๋วได้คือ</div>
            <div class="date">${formatDate(bookingDate)}</div>
            <div style="font-size:12px;color:#64748b;font-weight:800">
              สำหรับการเดินทางวันที่ ${formatDate(travelDate)}
            </div>
            <div class="time">⏰ เริ่มจองได้ตั้งแต่เวลา 08.30 น. เป็นต้นไป</div>
            <a class="patch-action" href="${OFFICIAL_DTICKET_URL}" target="_blank" rel="noopener noreferrer">
              เปิดเว็บไซต์ D-Ticket
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function updateDistanceDisplay(total, passenger) {
    const box = $('distanceBox');
    if (!box) return;
    const valid = Number.isFinite(total) && Number.isFinite(passenger) && total > 0 && passenger > 0;
    box.classList.toggle('hidden', !valid || getInputMode() !== 'station');
    if (valid) {
      if ($('showTotal')) $('showTotal').textContent = `${total} กม.`;
      if ($('showPassenger')) $('showPassenger').textContent = `${passenger} กม.`;
    }
  }

  function calculateBookingPatched() {
    updateReservationTypeVisibility();

    const travelDate = parseLocalDate($('travelDate')?.value || '');
    if (!travelDate) {
      renderBookingEmpty();
      return;
    }

    const today = localDateOnly();
    if (travelDate < today) {
      renderBookingError('วันที่เดินทางผ่านไปแล้ว กรุณาเลือกวันที่วันนี้หรือวันในอนาคต');
      return;
    }

    const mode = getInputMode();
    if (mode === 'station' && !$('selectedLine')?.value) {
      renderBookingEmpty();
      return;
    }

    const selectedTrain = getSelectedTrain();

    // ขบวน 997/998 ใช้ค่าโดยสารอัตราพิเศษและเปิดขายภายใน 48 ชั่วโมงก่อนรถออก
    // เงื่อนไขนี้ต้องมาก่อนการคำนวณตามระยะทาง 1 / 30 / 90 วัน
    if (mode === 'station' && selectedTrain && SPECIAL_48_HOUR_TRAIN_IDS.has(selectedTrain.id)) {
      const { total, passenger, routeValid } = getDistances();
      updateDistanceDisplay(total, passenger);

      if (!Number.isFinite(total) || !Number.isFinite(passenger)) {
        renderBookingEmpty();
        return;
      }

      if (!routeValid) {
        renderBookingError('สถานีขึ้นและสถานีลงของผู้โดยสารต้องอยู่ภายในช่วงต้นทาง–ปลายทางของขบวนรถ');
        return;
      }

      if (total <= 0 || passenger <= 0) {
        renderBookingError('สถานีขึ้นและสถานีลงต้องไม่เป็นสถานีเดียวกัน');
        return;
      }

      renderSpecial48Hour(travelDate);
      return;
    }

    const reservationType = getCurrentReservationType();
    if (!reservationType) {
      renderBookingError('กรุณาเลือกประเภทขบวนว่าเป็นขบวนสำรองที่นั่งหรือขบวนไม่สำรองที่นั่ง');
      return;
    }

    if (reservationType === 'nonreserved') {
      updateDistanceDisplay(NaN, NaN);
      renderNonReserved(travelDate);
      return;
    }

    const { total, passenger, routeValid } = getDistances();
    updateDistanceDisplay(total, passenger);

    if (!Number.isFinite(total) || !Number.isFinite(passenger)) {
      renderBookingEmpty();
      return;
    }

    if (!routeValid) {
      renderBookingError('สถานีขึ้นและสถานีลงของผู้โดยสารต้องอยู่ภายในช่วงต้นทาง–ปลายทางของขบวนรถ');
      return;
    }

    if (total <= 0 || passenger <= 0) {
      renderBookingError('ระยะทางต้องมากกว่า 0 กิโลเมตร และสถานีต้นทางต้องไม่ซ้ำกับสถานีปลายทาง');
      return;
    }

    if (passenger > total) {
      renderBookingError('ระยะทางที่ผู้โดยสารเดินทางต้องไม่เกินระยะทางวิ่งทั้งหมดของขบวนรถ');
      return;
    }

    const percentageValue = (passenger / total) * 100;
    const days = percentageValue >= 60 ? 90 : percentageValue >= 25 ? 30 : 1;
    const bookingDate = new Date(travelDate);
    bookingDate.setDate(bookingDate.getDate() - days);

    renderBookingResult({
      percentage: percentageValue.toFixed(2),
      days,
      bookingDate,
      travelDate
    });
  }

  const MONTHLY_PERIODS = {
    week: {
      label: 'รายสัปดาห์',
      normalDays: 6,
      studentDays: 5,
      generalRate: 0.75,
      halfRate: 0.50,
      studentRate: 0.50
    },
    m1: {
      label: 'ราย 1 เดือน',
      normalDays: 24,
      studentDays: 20,
      generalRate: 0.75,
      halfRate: 0.50,
      studentRate: 0.50
    },
    m2: {
      label: 'ราย 2 เดือน',
      normalDays: 48,
      studentDays: 40,
      generalRate: 0.72,
      halfRate: 0.50,
      studentRate: 0.47
    },
    m3: {
      label: 'ราย 3 เดือน',
      normalDays: 72,
      studentDays: 60,
      generalRate: 0.70,
      halfRate: 0.50,
      studentRate: 0.45
    }
  };

  const STUDENT_OVERRIDES = {
    2: { week: 10, m1: 40, m2: 76, m3: 108 },
    5: { week: 26, m1: 100, m2: 188, m3: 270 }
  };

  const PASSENGER_LABELS = {
    general: 'ประชาชนทั่วไป',
    half: 'ผู้มีสิทธิลดครึ่งราคา',
    student: 'นักเรียน / นักศึกษา'
  };

  function updateMonthlyOptions() {
    const tripsEl = $('monthlyTrips');
    const passengerEl = $('monthlyPassenger');
    const periodEl = $('monthlyPeriod');
    if (!tripsEl || !passengerEl || !periodEl) return;

    const trips = Number.parseInt(tripsEl.value || '1', 10);
    const studentOption = passengerEl.querySelector('option[value="student"]');

    if (studentOption) {
      studentOption.disabled = trips !== 2;
      studentOption.textContent = trips === 2
        ? 'นักเรียน / นักศึกษา'
        : 'นักเรียน / นักศึกษา (ใช้ได้เฉพาะไป-กลับ)';
    }

    if (trips !== 2 && passengerEl.value === 'student') {
      passengerEl.value = 'general';
    }

    const useStudentDays = trips === 2 && passengerEl.value === 'student';
    Object.entries(MONTHLY_PERIODS).forEach(([key, period]) => {
      const option = periodEl.querySelector(`option[value="${key}"]`);
      if (option) {
        const days = useStudentDays ? period.studentDays : period.normalDays;
        option.textContent = `${period.label} คิด ${days} วัน`;
      }
    });
  }

  function renderMonthlyEmpty() {
    const result = $('monthlyResult');
    if (!result) return;
    result.innerHTML = `
      <div class="empty">
        <div class="big">🎟️</div>
        <p>กรุณากรอกค่าโดยสารเต็มราคา<br>เพื่อคำนวณตั๋วเดือน</p>
      </div>
    `;
  }

  function calculateMonthlyPatched() {
    updateMonthlyOptions();

    const result = $('monthlyResult');
    if (!result) return;

    const fare = Number.parseFloat($('monthlyFare')?.value || '');
    const trips = Number.parseInt($('monthlyTrips')?.value || '1', 10);
    let passenger = $('monthlyPassenger')?.value || 'general';
    const periodKey = $('monthlyPeriod')?.value || 'week';
    const period = MONTHLY_PERIODS[periodKey];

    if (!Number.isFinite(fare) || fare <= 0) {
      renderMonthlyEmpty();
      return;
    }

    if (passenger === 'student' && trips !== 2) {
      passenger = 'general';
      if ($('monthlyPassenger')) $('monthlyPassenger').value = 'general';
    }

    const isStudent = passenger === 'student' && trips === 2;
    const days = isStudent ? period.studentDays : period.normalDays;
    const rate = passenger === 'general'
      ? period.generalRate
      : passenger === 'half'
        ? period.halfRate
        : period.studentRate;

    const base = fare * trips * days;
    const rawPrice = base * rate;

    const override = isStudent && STUDENT_OVERRIDES[fare]
      ? STUDENT_OVERRIDES[fare][periodKey]
      : undefined;
    const usesOverride = Number.isFinite(override);
    const finalPrice = usesOverride ? override : roundFinalBaht(rawPrice);

    const saving = Math.max(0, base - finalPrice);
    const avgPerDay = finalPrice / days;
    const avgPerTrip = finalPrice / (days * trips);
    const tripText = trips === 2 ? 'ไป-กลับ วันละ 2 เที่ยว' : 'เที่ยวเดียว วันละ 1 เที่ยว';
    const rateText = `คิด ${(rate * 100).toFixed(0)}%`;
    const specialText = usesOverride
      ? `ใช้ราคากรณีพิเศษที่ผู้จัดทำตรวจสอบไว้สำหรับค่าโดยสาร ${money(fare)} บาท`
      : 'ยกเศษเฉพาะราคาขั้นสุดท้าย: ต่ำกว่า 50 สตางค์ตัดทิ้ง ตั้งแต่ 50 สตางค์ขึ้นไปยกเป็น 1 บาท';

    result.innerHTML = `
      <div class="price-card">
        <div class="price-inner">
          <div class="price-kicker">${period.label} • ${PASSENGER_LABELS[passenger]} • ${tripText}</div>
          <div class="price-main">${money(finalPrice)} <small>บาท</small></div>
          <div class="summary-row"><span>ฐานราคาก่อนคิดอัตรา</span><strong>${money(base)} บาท</strong></div>
          <div class="summary-row"><span>เกณฑ์ที่ใช้</span><strong>${days} วัน / ${rateText}</strong></div>
          <div class="summary-row"><span>ราคาตามสูตรก่อนยกเศษ</span><strong>${money(rawPrice)} บาท</strong></div>
          <div class="summary-row"><span>ราคาประมาณการขั้นสุดท้าย</span><strong>${money(finalPrice)} บาท</strong></div>
          <div class="summary-row"><span>วิธีคิดกรณีนี้</span><strong>${escapeHtml(specialText)}</strong></div>
          <div class="summary-row"><span>ประหยัดโดยประมาณ</span><strong>${money(saving)} บาท</strong></div>
          <div class="price-grid">
            <div class="price-mini"><span>เฉลี่ยต่อวัน</span><strong>${money(avgPerDay)} บาท</strong></div>
            <div class="price-mini"><span>เฉลี่ยต่อเที่ยว</span><strong>${money(avgPerTrip)} บาท</strong></div>
          </div>
          <div class="formula">
            สูตรมาตรฐาน: ${money(fare)} × ${trips} เที่ยว/วัน × ${days} วัน × ${(rate * 100).toFixed(0)}%
            = ${money(rawPrice)} บาท
            ${usesOverride ? `→ ใช้ราคากรณีพิเศษ ${money(finalPrice)} บาท` : `→ ยกเศษขั้นสุดท้าย ${money(finalPrice)} บาท`}
          </div>
          <div class="warning-note">
            เครื่องมือตั๋วเดือนเป็นการประมาณการ ค่าโดยสาร 2 และ 5 บาทของนักเรียน/นักศึกษาไป-กลับใช้ค่าที่ผู้จัดทำบันทึกจากระบบขายจริง ส่วนค่าอื่นต้องตรวจสอบกับระบบขายตั๋วหรือเจ้าหน้าที่ทุกครั้ง
          </div>
        </div>
      </div>
    `;
  }

  function updateSpecialTrainLabels() {
    const option = $('selectedTrain')?.querySelector('option[value="997/998"]');
    if (option) {
      option.textContent = '997/998 พิเศษโดยสาร (อัตราพิเศษ: เปิดขายภายใน 48 ชม.)';
    }

    document.querySelectorAll('.notice li').forEach((item) => {
      if (item.textContent.includes('997/998')) {
        item.textContent = 'ขบวน 997/998 ใช้ค่าโดยสารอัตราพิเศษ ระบบจำหน่ายจะอนุญาตเมื่อเข้าสู่ช่วง 48 ชั่วโมงก่อนเวลาขบวนรถออก ไม่ใช้เกณฑ์ 1 / 30 / 90 วัน';
      }
    });
  }

  function professionalizeNotices() {
    const info = document.querySelector('.tool-info-card');
    if (info) {
      info.innerHTML = `
        <strong>หมายเหตุสำคัญ:</strong> เว็บนี้ไม่ใช่ระบบจำหน่ายตั๋วอย่างเป็นทางการ
        ผลลัพธ์เป็นเครื่องมือช่วยคำนวณเบื้องต้น โปรดตรวจสอบกับ D-Ticket เจ้าหน้าที่สถานี
        หรือสายด่วน 1690 ก่อนทำรายการทุกครั้ง
        <span class="patch-version">PATCH v5</span>
      `;
    }

    const footer = document.querySelector('.footer');
    if (footer) {
      footer.innerHTML = `
        <strong>จัดทำโดย นายพชรวิชญ์ ตุ้มวิจิตร</strong><br>
        นายสถานีคลองบางพระ | เครื่องมือนี้ใช้ช่วยคำนวณเบื้องต้น ไม่ใช่ระบบจำหน่ายตั๋วอย่างเป็นทางการ
        โปรดตรวจสอบข้อมูลกับ D-Ticket เจ้าหน้าที่สถานี หรือสายด่วน 1690
      `;
    }
  }

  function bindAfterOriginal(element, eventName, handler) {
    if (!element) return;
    element.addEventListener(eventName, () => {
      window.setTimeout(handler, 0);
    });
  }

  function init() {
    injectPatchStyles();
    insertReservationTypeFields();
    professionalizeNotices();
    updateSpecialTrainLabels();

    const travelDate = $('travelDate');
    if (travelDate) travelDate.min = toLocalISO();

    [
      'travelDate', 'selectedLine', 'selectedTrain',
      'trainOrigin', 'trainDest', 'passOrigin', 'passDest',
      'totalDistance', 'passengerDistance',
      'stationTrainType', 'manualTrainType'
    ].forEach((id) => {
      const element = $(id);
      bindAfterOriginal(element, 'input', calculateBookingPatched);
      bindAfterOriginal(element, 'change', calculateBookingPatched);
    });

    bindAfterOriginal($('modeStation'), 'click', calculateBookingPatched);
    bindAfterOriginal($('modeManual'), 'click', calculateBookingPatched);
    bindAfterOriginal($('selectedLine'), 'change', updateSpecialTrainLabels);
    bindAfterOriginal($('selectedTrain'), 'change', updateSpecialTrainLabels);

    ['monthlyFare', 'monthlyTrips', 'monthlyPassenger', 'monthlyPeriod'].forEach((id) => {
      const element = $(id);
      bindAfterOriginal(element, 'input', calculateMonthlyPatched);
      bindAfterOriginal(element, 'change', calculateMonthlyPatched);
    });

    updateReservationTypeVisibility();
    calculateBookingPatched();
    updateMonthlyOptions();
    renderMonthlyEmpty();

    console.info('SRT Ticket Tools: Correctness Patch v5 loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
