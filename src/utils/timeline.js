const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Assigns sizes ('full', 'half', 'quarter') and packs photos into a 
 * compact multi-column grid layout based on monthly density.
 */
function tileMonthPhotos(photos) {
  const count = photos.length;
  if (count === 0) return { tiles: [], width: 300 };

  let tiles = [];
  let colWidth = 200; // base column unit width

  if (count === 1) {
    tiles = [{ ...photos[0], size: 'full', colSpan: 2, rowSpan: 2 }];
    colWidth = 400;
  } else if (count === 2) {
    tiles = photos.map(p => ({ ...p, size: 'full', colSpan: 2, rowSpan: 2 }));
    colWidth = 420 * 2;
  } else if (count <= 5) {
    tiles = photos.map((p, i) => ({
      ...p,
      size: i % 2 === 0 ? 'full' : 'half',
      colSpan: i % 2 === 0 ? 2 : 1,
      rowSpan: i % 2 === 0 ? 2 : 1
    }));
    colWidth = Math.ceil(count * 220);
  } else {
    tiles = photos.map((p, i) => {
      const mod = i % 3;
      return {
        ...p,
        size: mod === 0 ? 'half' : 'quarter',
        colSpan: mod === 0 ? 2 : 1,
        rowSpan: 1
      };
    });
    colWidth = Math.ceil(count * 160);
  }

  return {
    tiles,
    width: Math.max(320, colWidth)
  };
}

export function calculateTimelineSegments(images) {
  if (images.length === 0) {
    const now = new Date();
    return [{
      type: 'month',
      year: now.getFullYear(),
      month: now.getMonth(),
      tiles: [],
      width: 300,
      label: `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    }];
  }

  const photoMap = new Map();
  images.forEach(img => {
    const d = new Date(img.takenAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!photoMap.has(key)) photoMap.set(key, []);
    photoMap.get(key).push(img);
  });

  const dates = images.map(img => new Date(img.takenAt));
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

  function startYearLabel(m) { return m.month === 0 ? `${m.year}` : `${monthNames[m.month]} ${m.year}`; }
  function endYearLabel(m) { return m.month === 11 ? `${m.year}` : `${monthNames[m.month]} ${m.year}`; }

  const flushEmptyRun = () => {
    if (emptyRun.length === 0) return;
    if (emptyRun.length <= 2) {
      emptyRun.forEach(m => {
        processedSegments.push({
          type: 'month',
          year: m.year,
          month: m.month,
          tiles: [],
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

  allMonths.forEach(m => {
    if (m.photos.length === 0) {
      emptyRun.push(m);
    } else {
      flushEmptyRun();
      const tiled = tileMonthPhotos(m.photos);
      processedSegments.push({
        type: 'month',
        year: m.year,
        month: m.month,
        tiles: tiled.tiles,
        width: tiled.width,
        label: `${monthNames[m.month]} ${m.year}`
      });
    }
  });
  flushEmptyRun();

  return processedSegments;
}