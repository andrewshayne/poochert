import { useRef, useState, useEffect, useCallback } from 'react';
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

export default function App() {
  const parentRef = useRef(null);
  
  const [images, setImages] = useState([]);
  const [dogName, setDogName] = useState('Poochert');
  
  // Admin & Editing State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null); 
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);

  // DOM & Animation Refs
  const scrollbarTrackRef = useRef(null);
  const thumbRef = useRef(null);
  const yearRef = useRef(null);
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

  // Fetch timeline data
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
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 420, 
    overscan: 3,
  });

  const totalWidth = virtualizer.getTotalSize();
  const pixelsPerMonth = totalWidth / totalMonths;

  // 60FPS Smooth Scroll Engine
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

  // Drag and Drop Upload Handlers
  const handleDragOver = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] || 'bailey';

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('takenAt', new Date().toISOString().split('T')[0]);
      formData.append('caption', file.name);

      try {
        const res = await fetch(`/${slug}/api/upload`, {
          method: 'POST',
          headers: { 'X-Admin-Secret': adminSecret },
          body: formData
        });
        if (!res.ok) alert('Upload failed. Check your admin secret.');
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    fetchPhotos();
  };

  // Save updated photo metadata
  const handleSavePhotoChanges = async (e) => {
    e.preventDefault();
    if (!selectedPhoto) return;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] || 'bailey';

    try {
      const res = await fetch(`/${slug}/api/photos/${selectedPhoto.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify({
          takenAt: selectedPhoto.takenAt,
          caption: selectedPhoto.caption
        })
      });

      if (res.ok) {
        setSelectedPhoto(null);
        fetchPhotos();
      } else {
        alert('Failed to update photo.');
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  // Delete photo handler
  const handleDeletePhoto = async (e, photoId) => {
    e.stopPropagation(); // Prevent opening the edit modal
    if (!window.confirm("Are you sure you want to delete this photo?")) return;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slug = pathParts[0] || 'bailey';

    try {
      const res = await fetch(`/${slug}/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Secret': adminSecret }
      });

      if (res.ok) {
        fetchPhotos();
      } else {
        alert('Failed to delete photo.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Gallery Mouse Navigation
  const handleGalleryMouseDown = (e) => {
    if (selectedPhoto) return;
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

  // Custom Scrollbar Drag
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
      const maxThumbTravel = trackWidth - 120; 
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

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault(); 
      targetScroll.current += e.deltaY + e.deltaX; 
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ height: '100vh', width: '100vw', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', position: 'relative' }}
    >
      {/* ADMIN TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#1E293B' }}>{dogName}&apos;s Timeline</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!isAdmin ? (
            <button 
              onClick={() => {
                const secret = prompt('Enter Admin Secret:');
                if (secret) {
                  setAdminSecret(secret);
                  setIsAdmin(true);
                }
              }}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white', cursor: 'pointer' }}
            >
              Admin Mode
            </button>
          ) : (
            <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 'bold' }}>🔒 Admin Active (Drag & Drop Enabled)</span>
          )}
        </div>
      </div>

      {/* DRAG AND DROP OVERLAY */}
      {isDraggingOver && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '4px dashed #3B82F6', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <h2 style={{ color: '#1D4ED8' }}>Drop photos here to upload to R2!</h2>
        </div>
      )}

      {/* VIEWPORT */}
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
              const image = images[virtualItem.index];
              if (!image) return null;
              
              return (
                <div 
                  key={virtualItem.key} 
                  onMouseEnter={() => setHoveredPhotoId(image.id)}
                  onMouseLeave={() => setHoveredPhotoId(null)}
                  onClick={() => isAdmin && setSelectedPhoto(image)}
                  style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${virtualItem.size}px`, transform: `translateX(${virtualItem.start}px)`, paddingRight: '20px', boxSizing: 'border-box', cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  <div style={{ position: 'relative', height: '100%', width: '100%' }}>
                    <img src={image.url} alt={image.alt} draggable={false} style={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: '12px', pointerEvents: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    
                    {/* DATE & EDIT BADGE */}
                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>
                      {image.takenAt} {isAdmin && '✏️ Edit'}
                    </div>

                    {/* RED DELETE 'X' BUTTON ON HOVER (ADMIN ONLY) */}
                    {isAdmin && hoveredPhotoId === image.id && (
                      <button
                        onClick={(e) => handleDeletePhoto(e, image.id)}
                        title="Delete photo"
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '32px',
                          backgroundColor: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          transition: 'transform 0.1s ease'
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

          {/* TIMELINE TICKS */}
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

      {/* CUSTOM SCROLLBAR */}
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
            left: 0, 
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div style={{ position: 'absolute', top: '-30px', backgroundColor: '#1E293B', color: 'white', padding: '4px 12px', borderRadius: '99px', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <span ref={yearRef}>{startYear}</span> 
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {selectedPhoto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleSavePhotoChanges} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>Edit Photo Details</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Date Taken:</label>
              <input 
                type="date" 
                value={selectedPhoto.takenAt} 
                onChange={(e) => setSelectedPhoto({ ...selectedPhoto, takenAt: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Caption:</label>
              <input 
                type="text" 
                value={selectedPhoto.caption || ''} 
                onChange={(e) => setSelectedPhoto({ ...selectedPhoto, caption: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setSelectedPhoto(null)} style={{ padding: '8px 12px', background: '#E2E8F0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 12px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}