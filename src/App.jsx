import { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const startYear = 1996;
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth(); 
const totalMonths = (currentYear - startYear) * 12 + currentMonth + 1;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const timelineMonths = Array.from({ length: totalMonths }).map((_, i) => {
  const date = new Date(startYear, i, 1);
  return { index: i, year: date.getFullYear(), month: date.getMonth(), isJan: date.getMonth() === 0 };
});

const mockImages = Array.from({ length: 500 }).map((_, i) => ({
  id: i, url: `https://place.dog/400/300?id=${i}`, alt: `Good dog ${i}`,
}));

export default function App() {
  const parentRef = useRef(null);
  
  // References for direct DOM manipulation (bypassing React re-renders)
  const scrollbarTrackRef = useRef(null);
  const thumbRef = useRef(null);
  const yearRef = useRef(null);

  // Animation & Lerp State
  const targetScroll = useRef(0);
  const requestRef = useRef();

  // Visual grabbing states for CSS cursors
  const [isGalleryGrabbing, setIsGalleryGrabbing] = useState(false);
  const [isThumbGrabbing, setIsThumbGrabbing] = useState(false);

  // Drag mathematics state (kept in refs to avoid re-renders during drag)
  const isDraggingGallery = useRef(false);
  const galleryStartX = useRef(0);
  const galleryStartScroll = useRef(0);
  
  const isDraggingThumb = useRef(false);
  const thumbStartX = useRef(0);
  const thumbStartScroll = useRef(0);

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: mockImages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 420, 
    overscan: 3,
  });

  const totalWidth = virtualizer.getTotalSize();
  const pixelsPerMonth = totalWidth / totalMonths;

  // --- THE SMOOTH SCROLL ENGINE (60 FPS) ---
  useEffect(() => {
    const update = () => {
      if (parentRef.current) {
        const el = parentRef.current;
        const maxScroll = el.scrollWidth - el.clientWidth;
        
        // 1. Clamp the target so we can't scroll past the edges
        targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
        
        // 2. Linear Interpolation (Lerp) to smoothly close the distance
        const diff = targetScroll.current - el.scrollLeft;
        
        if (Math.abs(diff) > 0.5) {
          el.scrollLeft += diff * 0.12; // Easing factor: Lower = smoother/slower, Higher = snappier
        } else {
          el.scrollLeft = targetScroll.current; // Snap to target when extremely close
        }

        // 3. Update Custom Scrollbar & Year directly in the DOM
        const progress = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
        
        if (thumbRef.current) {
          thumbRef.current.style.left = `calc(${progress * 100}% - ${progress * 120}px)`;
        }
        
        if (yearRef.current) {
          const calculatedYear = startYear + Math.round(progress * (currentYear - startYear));
          if (yearRef.current.innerText !== String(calculatedYear)) {
            yearRef.current.innerText = calculatedYear;
          }
        }
      }
      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // --- GALLERY PANNING LOGIC ---
  const handleGalleryMouseDown = (e) => {
    isDraggingGallery.current = true;
    setIsGalleryGrabbing(true);
    galleryStartX.current = e.pageX;
    galleryStartScroll.current = targetScroll.current;
  };

  const handleGalleryMouseMove = (e) => {
    if (!isDraggingGallery.current) return;
    e.preventDefault();
    const walk = e.pageX - galleryStartX.current;
    targetScroll.current = galleryStartScroll.current - walk;
  };

  const handleGalleryMouseUp = () => {
    isDraggingGallery.current = false;
    setIsGalleryGrabbing(false);
  };

  // --- CUSTOM SCROLLBAR DRAG LOGIC ---
  const handleThumbMouseDown = (e) => {
    e.stopPropagation(); 
    e.preventDefault();
    isDraggingThumb.current = true;
    setIsThumbGrabbing(true);
    thumbStartX.current = e.clientX;
    thumbStartScroll.current = targetScroll.current;
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isDraggingThumb.current || !scrollbarTrackRef.current || !parentRef.current) return;
      
      const deltaX = e.clientX - thumbStartX.current;
      const trackWidth = scrollbarTrackRef.current.clientWidth;
      const maxThumbTravel = trackWidth - 120; // 120px thumb width
      
      const deltaProgress = deltaX / maxThumbTravel;
      const maxScroll = parentRef.current.scrollWidth - parentRef.current.clientWidth;
      
      targetScroll.current = thumbStartScroll.current + (deltaProgress * maxScroll);
    };

    const handleWindowMouseUp = () => {
      isDraggingThumb.current = false;
      setIsThumbGrabbing(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  // --- WHEEL LOGIC ---
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault(); 
      // Add both Y (standard wheel) and X (trackpad swipe) to support all devices
      targetScroll.current += e.deltaY + e.deltaX; 
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* We set overflowX to 'hidden' so the browser's native trackpad momentum doesn't fight our custom physics engine */}
      <div
        ref={parentRef}
        onMouseDown={handleGalleryMouseDown}
        onMouseLeave={handleGalleryMouseUp}
        onMouseUp={handleGalleryMouseUp}
        onMouseMove={handleGalleryMouseMove}
        style={{
          flex: 1,
          width: '100%',
          overflowX: 'hidden', 
          overflowY: 'hidden',
          cursor: isGalleryGrabbing ? 'grabbing' : 'grab', 
          userSelect: 'none', 
          position: 'relative',
        }}
      >
        <div style={{ height: '100%', width: `${totalWidth}px`, position: 'relative' }}>
          
          <div style={{ height: 'calc(100% - 100px)', position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const image = mockImages[virtualItem.index];
              return (
                <div key={virtualItem.key} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${virtualItem.size}px`, transform: `translateX(${virtualItem.start}px)`, paddingRight: '20px', boxSizing: 'border-box' }}>
                  <img src={image.url} alt={image.alt} draggable={false} style={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: '12px', pointerEvents: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                </div>
              );
            })}
          </div>

          <div style={{ height: '100px', width: '100%', position: 'absolute', bottom: 0 }}>
            <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, height: '6px', backgroundColor: '#CBD5E1', borderRadius: '3px' }} />
            
            {timelineMonths.map((item) => {
              const leftPos = item.index * pixelsPerMonth;
              return (
                <div key={item.index} style={{ position: 'absolute', left: `${leftPos}px`, top: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
                  <div style={{ width: item.isJan ? '4px' : '2px', height: item.isJan ? '24px' : '12px', backgroundColor: item.isJan ? '#334155' : '#94A3B8', marginTop: item.isJan ? '-9px' : '-3px', borderRadius: '2px' }} />
                  {item.isJan ? (
                    <span style={{ marginTop: '8px', fontWeight: 'bold', color: '#475569', fontSize: '14px' }}>{item.year}</span>
                  ) : (
                    <span style={{ marginTop: '8px', color: '#94A3B8', fontSize: '12px', fontWeight: '500' }}>{monthNames[item.month]}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={scrollbarTrackRef} style={{ width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '5px', marginTop: '40px', position: 'relative' }}>
        
        <div 
          ref={thumbRef}
          onMouseDown={handleThumbMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            height: '100%',
            width: '120px', 
            backgroundColor: isThumbGrabbing ? '#475569' : '#64748B', 
            borderRadius: '5px',
            cursor: isThumbGrabbing ? 'grabbing' : 'grab',
            left: 0, // Now updated via the animation loop
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div style={{ position: 'absolute', top: '-30px', backgroundColor: '#1E293B', color: 'white', padding: '4px 12px', borderRadius: '99px', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {/* Start year is the initial state before the animation loop updates it */}
            <span ref={yearRef}>{startYear}</span> 
          </div>
        </div>
      </div>
    </div>
  );
}