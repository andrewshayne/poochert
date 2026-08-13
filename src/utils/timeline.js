const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Packs photos into horizontal masonry rows using shortest-row packing.
 */
function packHorizontalMasonry(photos, aspectRatios = {}, trackHeight = 320) {
  const count = photos.length;
  if (count === 0) return { rows: [[]], width: 180 };

  // 1 photo -> 1 row; 2+ photos -> 2 rows
  const numRows = count === 1 ? 1 : 2;
  const rows = Array.from({ length: numRows }, () => []);
  const rowWidthSums = new Array(numRows).fill(0);

  photos.forEach((photo) => {
    // Default to 4:3 landscape ratio until image metadata loads
    const ratio = aspectRatios[photo.id] || photo.aspectRatio || 1.333;

    // Find the row with the smallest current accumulated width ratio
    let shortestRowIndex = 0;
    let minWidth = rowWidthSums[0];
    for (let r = 1; r < numRows; r++) {
      if (rowWidthSums[r] < minWidth) {
        minWidth = rowWidthSums[r];
        shortestRowIndex = r;
      }
    }

    rows[shortestRowIndex].push({ ...photo, ratio });
    rowWidthSums[shortestRowIndex] += ratio;
  });

  // Calculate pixel width dynamically based on the exact DOM track height
  const gapPx = 12;
  const rowHeight = numRows === 1 ? trackHeight : (trackHeight - gapPx) / 2;

  let maxPixelWidth = 0;
  for (let r = 0; r < numRows; r++) {
    const rowPixelWidth =
      rowWidthSums[r] * rowHeight +
      Math.max(0, rows[r].length - 1) * gapPx;
    if (rowPixelWidth > maxPixelWidth) {
      maxPixelWidth = rowPixelWidth;
    }
  }

  return {
    rows,
    width: Math.max(220, Math.ceil(maxPixelWidth + 40)) // Includes padding buffer
  };
}

export function calculateTimelineSegments(images, aspectRatios = {}, trackHeight = 320) {
  if (!images || images.length === 0) {
    const now = new Date();
    return [
      {
        type: 'month',
        year: now.getFullYear(),
        month: now.getMonth(),
        rows: [[]],
        width: 300,
        label: `${monthNames[now.getMonth()]} ${now.getFullYear()}`
      }
    ];
  }

  const photoMap = new Map();
  images.forEach((img) => {
    const d = new Date(img.takenAt);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!photoMap.has(key)) photoMap.set(key, []);
    photoMap.get(key).push(img);
  });

  const dates = images
    .map((img) => new Date(img.takenAt))
    .filter((d) => !isNaN(d.getTime()));

  if (dates.length === 0) return [];

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date();

  const allMonths = [];
  let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  while (curr <= end) {
    const year = curr.getFullYear();
    const month = curr.getMonth();
    const key = `${year}-${String(month).padStart(2, '0')}`;
    allMonths.push({ year, month, photos: photoMap.get(key) || [] });
    curr.setMonth(curr.getMonth() + 1);
  }

  const processedSegments = [];
  let emptyRun = [];

  function startYearLabel(m) {
    return m.month === 0 ? `${m.year}` : `${monthNames[m.month]} ${m.year}`;
  }
  function endYearLabel(m) {
    return m.month === 11 ? `${m.year}` : `${monthNames[m.month]} ${m.year}`;
  }

  const flushEmptyRun = () => {
    if (emptyRun.length === 0) return;
    if (emptyRun.length <= 2) {
      emptyRun.forEach((m) => {
        processedSegments.push({
          type: 'month',
          year: m.year,
          month: m.month,
          rows: [[]],
          width: 180,
          label: `${monthNames[m.month]} ${m.year}`
        });
      });
    } else {
      const start = emptyRun[0];
      const end = emptyRun[emptyRun.length - 1];
      processedSegments.push({
        type: 'gap',
        startYear: start.year,
        startMonth: start.month,
        endYear: end.year,
        endMonth: end.month,
        width: 100,
        label: `Gap: ${startYearLabel(start)} - ${endYearLabel(end)}`
      });
    }
    emptyRun = [];
  };

  allMonths.forEach((m) => {
    if (m.photos.length === 0) {
      emptyRun.push(m);
    } else {
      flushEmptyRun();
      // Pass the dynamically measured trackHeight into the packer
      const packed = packHorizontalMasonry(m.photos, aspectRatios, trackHeight);
      processedSegments.push({
        type: 'month',
        year: m.year,
        month: m.month,
        rows: packed.rows,
        width: packed.width,
        label: `${monthNames[m.month]} ${m.year}`
      });
    }
  });
  flushEmptyRun();

  return processedSegments;
}