import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { calculateTimelineSegments } from './utils/timeline';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function App() {
  const parentRef = useRef(null);
  
  const [images, setImages] = useState([]);
  const [dogName, setDogName] = useState('Bailey');
  const [aspectRatios, setAspectRatios] = useState({});
  const [trackHeight, setTrackHeight] = useState(320);
  
  // Admin & Editing State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null); 
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);

  // DOM & Animation Refs
  const scrollbarTrackRef = useRef(null);
  const thumbRef = useRef(null);
  const dateBubbleRef = useRef(null);
  const targetScroll = useRef(0);
  const requestRef = useRef();

  const [isGalleryGrabbing, setIsGalleryGrabbing] = useState(false);
  const [isThumbGrabbing, setIsThumbGrabbing] = useState(false);

  const isDraggingGallery = useRef(false);
  const galleryStartX = useRef(0);
  const galleryStartScroll = useRef(0);
  
  const isDraggingThumb = useRef(false);
  const thumbStartX = useRef(0);
  const thumbStartScroll = useRef(0);

  // Capture natural image aspect ratios on load to recalculate masonry geometry
  const handleImageLoad = (id, e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      setAspectRatios(prev => {
        if (prev[id] === ratio) return prev;
        return { ...prev, [id]: ratio };
      });
    }
  };

  // Keep Virtualizer widths perfectly synced with DOM height mathematically
  useEffect(() => {
    const updateHeight = () => {
      if (parentRef.current) {
        const newHeight = parentRef.current.clientHeight - 100; 
        if (newHeight > 0) setTrackHeight(newHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Pass tracked DOM height into the segment calculator
  const segments = useMemo(
    () => calculateTimelineSegments(images, aspectRatios, trackHeight),
    [images, aspectRatios, trackHeight]
  );

  const fetchPhotos = useCallback(() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] || 'bailey';

    fetch(`/${slug}/api/photos`)
      .then(res => res.json())
      .then(data => {
        if (data.photos) {
          setDogName(data.dogName);
          const formattedImages = data.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            alt: photo.caption || 'Dog photo',
            takenAt: photo.takenAt,
            caption: photo.caption
          }));
          setImages(formattedImages);
        }
      })
      .catch(err => console.error("Failed to fetch timeline data:", err));
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => segments[index].width,
    overscan: 3,
  });

  const totalWidth = virtualizer.getTotalSize();

  // 60FPS Smooth Scroll Engine, True Screen-Space Fish-Eye Scaling, Date Label & Scrollbar Sync
  useEffect(() => {
    const update = () => {
      if (parentRef.current) {
        const el = parentRef.current;
        const maxScroll = el.scrollWidth - el.clientWidth;
        
        targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
        const diff = targetScroll.current - el.scrollLeft;
        
        if (Math.abs(diff) > 0.5) {
          el.scrollLeft += diff * 0.12; 
        } else {
          el.scrollLeft = targetScroll.current; 
        }

        // True Screen-Space Fish-Eye Bell-Curve Scaling via getBoundingClientRect()
        const containerRect = el.getBoundingClientRect();
        const containerCenterX = containerRect.left + containerRect.width / 2;
        const maxDist = containerRect.width / 2;

        const tileElements = el.querySelectorAll('.fish-eye-tile');
        tileElements.forEach(tileEl => {
          const tileRect = tileEl.getBoundingClientRect();
          const tileCenterX = tileRect.left + tileRect.width / 2;
          const distanceFromCenter = Math.abs(tileCenterX - containerCenterX);
          const normalizedDist = Math.min(1, distanceFromCenter / (maxDist || 1));
          
          // Bell-curve scale: 1.0 at screen center, 0.5 at screen edges
          const bellScale = 0.5 + 0.5 * Math.cos(normalizedDist * (Math.PI / 2));
          const isHovered = tileEl.dataset.hovered === 'true';

          tileEl.style.transform = `scale(${bellScale})`;
          tileEl.style.zIndex = isHovered ? '50' : Math.round(bellScale * 10).toString();
        });

        // Update Date Bubble (Month + Year)
        if (dateBubbleRef.current && segments.length > 0) {
          let accumulatedWidth = 0;
          let currentLabel = segments[0].label;
          
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (el.scrollLeft >= accumulatedWidth && el.scrollLeft < accumulatedWidth + seg.width) {
              currentLabel = seg.label;
              break;
            }
            accumulatedWidth += seg.width;
          }
          
          if (dateBubbleRef.current.innerText !== currentLabel) {
            dateBubbleRef.current.innerText = currentLabel;
          }
        }

        // Update Scrollbar Thumb Position
        if (scrollbarTrackRef.current && thumbRef.current && maxScroll > 0) {
          const trackWidth = scrollbarTrackRef.current.clientWidth;
          const thumbWidth = 120;
          const maxThumbTravel = Math.max(1, trackWidth - thumbWidth);
          const scrollProgress = el.scrollLeft / maxScroll;
          const thumbLeft = scrollProgress * maxThumbTravel;
          thumbRef.current.style.left = `${thumbLeft}px`;
        }
      }
      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [segments]);

  const handleAdminLogin = async () => {
    const secret = prompt('Enter Admin Secret:');
    if (!secret) return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0] || 'bailey';
    try {
      const res = await fetch(`/${slug}/api/verify-admin`, { method: 'POST', headers: { 'X-Admin-Secret': secret } });
      if (res.ok) { setAdminSecret(secret); setIsAdmin(true); } else { alert('Incorrect admin password.'); }
    } catch (err) { alert('Failed to verify.'); }
  };

  const handleDragOver = (e) => { if (!isAdmin) return; e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => { setIsDraggingOver(false); };

  const handleDrop = async (e) => {
    if (!isAdmin) return; e.preventDefault(); setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files); if (files.length === 0) return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0] || 'bailey';
    for (const file of files) {
      const formData = new FormData(); formData.append('file', file);
      formData.append('takenAt', new Date().toISOString().split('T')[0]);
      formData.append('caption', file.name);
      try {
        await fetch(`/${slug}/api/upload`, { method: 'POST', headers: { 'X-Admin-Secret': adminSecret }, body: formData });
      } catch (err) { console.error(err); }
    }
    fetchPhotos();
  };

  const handleSavePhotoChanges = async (e) => {
    e.preventDefault(); if (!selectedPhoto) return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0] || 'bailey';
    try {
      const res = await fetch(`/${slug}/api/photos/${selectedPhoto.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ takenAt: selectedPhoto.takenAt, caption: selectedPhoto.caption })
      });
      if (res.ok) { setSelectedPhoto(null); fetchPhotos(); } else { alert('Failed to update.'); }
    } catch (err) { console.error(err); }
  };

  const handleDeletePhoto = async (e, photoId) => {
    e.stopPropagation(); if (!window.confirm("Are you sure?")) return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0] || 'bailey';
    try {
      const res = await fetch(`/${slug}/api/photos/${photoId}`, { method: 'DELETE', headers: { 'X-Admin-Secret': adminSecret } });
      if (res.ok) fetchPhotos(); else alert('Failed to delete.');
    } catch (err) { console.error(err); }
  };

  const handleGalleryMouseDown = (e) => { if (selectedPhoto) return; isDraggingGallery.current = true; setIsGalleryGrabbing(true); galleryStartX.current = e.pageX; galleryStartScroll.current = targetScroll.current; };
  const handleGalleryMouseMove = (e) => { if (!isDraggingGallery.current) return; e.preventDefault(); const walk = e.pageX - galleryStartX.current; targetScroll.current = galleryStartScroll.current - walk; };
  const handleGalleryMouseUp = () => { isDraggingGallery.current = false; setIsGalleryGrabbing(false); };

  const handleTouchStart = (e) => {
    if (selectedPhoto) return;
    isDraggingGallery.current = true;
    setIsGalleryGrabbing(true);
    galleryStartX.current = e.touches[0].pageX;
    galleryStartScroll.current = targetScroll.current;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingGallery.current) return;
    // Multiplied by 2.2 to make mobile touch scrolling significantly faster and more responsive
    const walk = (e.touches[0].pageX - galleryStartX.current) * 2.2;
    targetScroll.current = galleryStartScroll.current - walk;
  };

  const handleTouchEnd = () => {
    isDraggingGallery.current = false;
    setIsGalleryGrabbing(false);
  };

  const handleThumbMouseDown = (e) => { e.stopPropagation(); e.preventDefault(); isDraggingThumb.current = true; setIsThumbGrabbing(true); thumbStartX.current = e.clientX; thumbStartScroll.current = targetScroll.current; };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isDraggingThumb.current || !scrollbarTrackRef.current || !parentRef.current) return;
      const deltaX = e.clientX - thumbStartX.current;
      const trackWidth = scrollbarTrackRef.current.clientWidth;
      const maxThumbTravel = Math.max(1, trackWidth - 120);
      const deltaProgress = deltaX / maxThumbTravel;
      const maxScroll = parentRef.current.scrollWidth - parentRef.current.clientWidth;
      targetScroll.current = thumbStartScroll.current + (deltaProgress * maxScroll);
    };
    const handleWindowMouseUp = () => { isDraggingThumb.current = false; setIsThumbGrabbing(false); };
    window.addEventListener('mousemove', handleWindowMouseMove); window.addEventListener('mouseup', handleWindowMouseUp);
    return () => { window.removeEventListener('mousemove', handleWindowMouseMove); window.removeEventListener('mouseup', handleWindowMouseUp); };
  }, []);

  useEffect(() => {
    const el = parentRef.current; if (!el) return;
    const handleWheel = (e) => { e.preventDefault(); targetScroll.current += e.deltaY + e.deltaX; };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{ height: '100vh', width: '100%', maxWidth: '100vw', padding: '8px 0 16px 0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: '#0b0f19', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '8px', padding: '0 16px' }}>
        <div />
        <h1 style={{ margin: 0, fontSize: '26px', color: '#F8FAFC', textAlign: 'center', fontWeight: '700' }}>{dogName}</h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
          {!isAdmin ? (
            <button onClick={handleAdminLogin} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #334155', background: '#1E293B', color: '#F8FAFC', cursor: 'pointer' }}>Admin Mode</button>
          ) : (
            <span style={{ fontSize: '12px', color: '#34D399', fontWeight: 'bold' }}>🔒 Admin Active</span>
          )}
        </div>
      </div>

      {isDraggingOver && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '4px dashed #3B82F6', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <h2 style={{ color: '#60A5FA' }}>Drop photos here to upload!</h2>
        </div>
      )}

      {/* GALLERY CONTAINER WITH RICH DARK HORIZONTAL VIGNETTE */}
      <div 
        style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}
      >
        {/* Rich Dark Horizontal Vignette Overlay */}
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          pointerEvents: 'none', 
          background: 'linear-gradient(to right, rgba(11,15,25,0.85) 0%, rgba(11,15,25,0) 18%, rgba(11,15,25,0) 82%, rgba(11,15,25,0.85) 100%)', 
          zIndex: 40 
        }} />

        <div 
          ref={parentRef} 
          onMouseDown={handleGalleryMouseDown} 
          onMouseLeave={handleGalleryMouseUp} 
          onMouseUp={handleGalleryMouseUp} 
          onMouseMove={handleGalleryMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ height: '100%', width: '100%', overflowX: 'hidden', overflowY: 'hidden', cursor: isGalleryGrabbing ? 'grabbing' : 'grab', userSelect: 'none', position: 'relative', touchAction: 'none' }}
        >
          <div style={{ height: '100%', width: `${totalWidth}px`, position: 'relative' }}>
            
            <div style={{ height: '100%', position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const segment = segments[virtualItem.index];
                if (!segment) return null;
                
                return (
                  <div key={virtualItem.key} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${virtualItem.size}px`, transform: `translateX(${virtualItem.start}px)`, boxSizing: 'border-box' }}>
                    
                    {/* PHOTOS CONTAINER (UPPER AREA) - HORIZONTAL MASONRY */}
                    <div style={{ height: 'calc(100% - 100px)', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: segment.type === 'gap' ? 'center' : 'flex-start', paddingRight: '20px', paddingLeft: '12px' }}>
                      
                      {segment.type === 'month' && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '12px', 
                          height: '100%', 
                          width: 'max-content',
                          justifyContent: 'center'
                        }}>
                          {segment.rows && segment.rows.map((row, rowIndex) => (
                            <div key={rowIndex} style={{
                              display: 'flex',
                              flexDirection: 'row',
                              gap: '12px',
                              height: segment.rows.length === 1 ? '100%' : 'calc(50% - 6px)',
                              alignItems: 'center'
                            }}>
                              {row.map((image) => {
                                const isHovered = hoveredPhotoId === image.id;

                                return (
                                  <div 
                                    key={image.id}
                                    className="fish-eye-tile"
                                    data-hovered={isHovered ? 'true' : 'false'}
                                    onMouseEnter={() => setHoveredPhotoId(image.id)}
                                    onMouseLeave={() => setHoveredPhotoId(null)}
                                    onClick={() => isAdmin && setSelectedPhoto(image)}
                                    style={{ 
                                      position: 'relative', 
                                      height: '100%', 
                                      aspectRatio: `${image.ratio}`,
                                      cursor: isAdmin ? 'pointer' : 'default',
                                      willChange: 'transform',
                                      flexShrink: 0
                                    }}
                                  >
                                    <div style={{ 
                                      position: 'relative', 
                                      height: '100%', 
                                      width: '100%',
                                      transform: `scale(${isHovered ? 1.08 : 1})`,
                                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out',
                                      transformOrigin: 'center center'
                                    }}>
                                      <img 
                                        src={image.url} 
                                        alt={image.alt} 
                                        draggable={false} 
                                        onLoad={(e) => handleImageLoad(image.id, e)}
                                        style={{ 
                                          height: '100%', 
                                          width: '100%', 
                                          objectFit: 'cover', 
                                          borderRadius: '12px', 
                                          pointerEvents: 'none', 
                                          boxShadow: isHovered ? '0 20px 36px rgba(0,0,0,0.6)' : '0 4px 6px rgba(0,0,0,0.3)' 
                                        }} 
                                      />
                                      <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                        {image.takenAt} {isAdmin && '✏️'}
                                      </div>
                                      {isAdmin && isHovered && (
                                        <button
                                          onClick={(e) => handleDeletePhoto(e, image.id)}
                                          title="Delete photo"
                                          style={{
                                            position: 'absolute', top: '8px', right: '8px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                          }}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}

                      {segment.type === 'gap' && (
                        <div style={{ color: '#64748B', fontSize: '42px', fontWeight: 'bold', letterSpacing: '10px' }}>
                          ···
                        </div>
                      )}
                    </div>

                    {/* TIMELINE TICKS (LOWER AREA) */}
                    <div style={{ height: '100px', width: '100%', position: 'absolute', bottom: 0 }}>
                      <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, height: '6px', backgroundColor: '#1E293B', borderRadius: '3px' }} />
                      
                      {segment.type === 'month' && (
                        <div style={{ position: 'absolute', left: '20px', top: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
                          <div style={{ width: '3px', height: '22px', backgroundColor: '#94A3B8', marginTop: '-5px', borderRadius: '2px' }} />
                          <span style={{ marginTop: '8px', color: '#E2E8F0', fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {monthNames[segment.month]} {segment.year}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* SCROLLBAR (Taller track & thumb) */}
      <div style={{ padding: '0 16px' }}>
        <div ref={scrollbarTrackRef} style={{ width: '100%', height: '14px', backgroundColor: '#1E293B', borderRadius: '7px', marginTop: '12px', position: 'relative' }}>
          <div ref={thumbRef} onMouseDown={handleThumbMouseDown} style={{ position: 'absolute', top: 0, height: '100%', width: '120px', backgroundColor: isThumbGrabbing ? '#64748B' : '#475569', borderRadius: '7px', cursor: isThumbGrabbing ? 'grabbing' : 'grab', left: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: '-42px', backgroundColor: '#1E293B', color: '#F8FAFC', padding: '6px 16px', borderRadius: '99px', fontSize: '15px', fontWeight: 'bold', pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 6px rgba(0,0,0,0.4)', border: '1px solid #334155' }}>
              <span ref={dateBubbleRef}>--</span> 
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {selectedPhoto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleSavePhotoChanges} style={{ backgroundColor: '#1E293B', color: '#F8FAFC', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0 }}>Edit Photo Details</h3>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#94A3B8' }}>Date Taken:</label>
            <input type="date" value={selectedPhoto.takenAt} onChange={(e) => setSelectedPhoto({ ...selectedPhoto, takenAt: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '16px', borderRadius: '4px', border: '1px solid #475569', background: '#0B0F19', color: '#F8FAFC' }} />
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#94A3B8' }}>Caption:</label>
            <input type="text" value={selectedPhoto.caption || ''} onChange={(e) => setSelectedPhoto({ ...selectedPhoto, caption: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '16px', borderRadius: '4px', border: '1px solid #475569', background: '#0B0F19', color: '#F8FAFC' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setSelectedPhoto(null)} style={{ padding: '8px 12px', background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 12px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}