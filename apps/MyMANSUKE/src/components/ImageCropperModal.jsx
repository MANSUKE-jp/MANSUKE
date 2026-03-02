import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';

export default function ImageCropperModal({ imageSrc, onCropDone, onCancel }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropComplete = useCallback((_, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (imageSrc, pixelCrop) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg', 0.95);
        });
    };

    const handleSave = async () => {
        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropDone(croppedBlob);
        } catch (e) {
            console.error(e);
        }
    };

    return createPortal(
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(4px) saturate(0.9)' }}>
            <div className="modal-panel" style={{ padding: 24, paddingBottom: 24, maxWidth: 500, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>画像の切り抜き</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                        <X size={24} />
                    </button>
                </div>
                
                <div style={{ position: 'relative', width: '100%', height: 300, background: '#333', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
                        キャンセル
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                        <Check size={16} /> 保存
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
