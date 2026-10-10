import React, { useRef } from 'react';
import { Copy, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { copyText } from './clipboard';
export default function PhotoShare() {
  const url = location.origin + location.pathname + '#photos';
  const qr = useRef(null);
  function downloadQr() {
    const a = document.createElement('a');
    a.href = qr.current.toDataURL('image/png');
    a.download = 'wedding-photo-qr.png';
    a.click();
  }
  return (
    <div className="photo-share">
      <div>
        <p className="overline">PHOTO COLLECTION</p>
        <h2>Wedding photo QR code</h2>
        <p>
          Print this QR code on table cards, or send the link to guests. Each
          guest enters their name and can upload up to 10 images per browser.
        </p>
        <p className="photo-url">{url}</p>
        <div className="share-buttons">
          <button className="action" onClick={() => copyText(url)}>
            <Copy size={16} /> Copy photo link
          </button>
          <button className="action highlight" onClick={downloadQr}>
            <Download size={16} /> Download QR code
          </button>
        </div>
      </div>
      <div className="qr-card">
        {/* Drawn large so the downloaded PNG prints sharply. */}
        <QRCodeCanvas ref={qr} value={url} size={1024} marginSize={2} />
        <span>Scan to share memories</span>
      </div>
    </div>
  );
}
