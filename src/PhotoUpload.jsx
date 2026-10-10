import React, { useEffect, useState } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
const MAX = 10,
  MAX_BYTES = 12 * 1024 * 1024,
  STORAGE = 'hadi_mariam_photo_uploads_v1';
const getSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '[]');
  } catch {
    return [];
  }
};
const safeName = (s) =>
  s
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 65) || 'Guest';
const ext = (file) =>
  ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  })[file.type] || 'jpg';
async function getConfig() {
  const r = await fetch(`${import.meta.env.BASE_URL}photo-config.json`, {
    cache: 'no-store',
  });
  if (!r.ok) throw Error('Upload configuration unavailable');
  return r.json();
}
function clientFor(config) {
  if (!config.region || !config.bucket || !config.identityPoolId)
    throw Error('Set region, bucket, and identityPoolId in photo-config.json.');
  return new S3Client({
    region: config.region,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region: config.region },
      identityPoolId: config.identityPoolId,
    }),
  });
}
export default function PhotoUpload() {
  const [name, setName] = useState(
    localStorage.getItem('wedding_photo_name') || '',
  );
  const [saved, setSaved] = useState(getSaved);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  const remaining = Math.max(0, MAX - saved.length);
  function choose(e) {
    const incoming = [...e.target.files];
    setError('');
    const valid = incoming.filter(
      (f) => f.type.startsWith('image/') && f.size <= MAX_BYTES && f.size > 0,
    );
    if (valid.length !== incoming.length)
      setError('Some images were skipped. Use image files under 12 MB each.');
    if (valid.length > remaining)
      setError(
        `Only ${remaining} more photo(s) allowed on this browser. Please choose fewer.`,
      );
    setFiles(valid.slice(0, remaining));
    e.target.value = '';
  }
  async function upload(e) {
    e.preventDefault();
    if (!name.trim() || !files.length || !config) return;
    setLoading(true);
    setError('');
    setStatus('');
    setProgress(0);
    localStorage.setItem('wedding_photo_name', name.trim());
    let completed = 0;
    try {
      if (config.mode !== 's3')
        throw Error(
          'S3 is not configured yet. Add Cognito Identity Pool settings to photo-config.json to enable real uploads.',
        );
      const s3 = clientFor(config);
      for (const file of files) {
        if (saved.length + completed >= MAX) break;
        const key = `${(config.prefix || 'wedding-photos').replace(/^\/+|\/+$/g, '')}/${safeName(name)}/${crypto.randomUUID()}.${ext(file)}`;
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: file,
            ContentType: file.type || 'image/jpeg',
            Metadata: { guest: safeName(name).slice(0, 60) },
          }),
        );
        const item = {
          key,
          name: name.trim(),
          uploadedAt: new Date().toISOString(),
        };
        setSaved((previous) => {
          const next = [...previous, item];
          localStorage.setItem(STORAGE, JSON.stringify(next));
          return next;
        });
        completed++;
        setProgress(completed);
      }
      setFiles([]);
      setStatus(
        `${completed} photo(s) uploaded successfully. Thank you for sharing your memories!`,
      );
    } catch (e) {
      setError(
        `${completed} uploaded. ${e.message || 'Upload failed. Please retry.'}`,
      );
      setFiles(files.slice(completed));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="site guest-bg photo-page">
      <header>
        <a href="./" className="small-nav">
          <ArrowLeft size={17} /> Wedding invitation
        </a>
        <span className="brand">
          Hadi <i>&</i> Mariam
        </span>
      </header>
      <main className="photo-main">
        <p className="overline">OUR WEDDING MEMORIES</p>
        <h1>Share your beautiful moments</h1>
        <p className="subline">
          Capture a smile, a dance, or your favorite memory from our
          celebration. You can contribute up to ten photos from this device.
        </p>
        <div className="glass photo-box">
          <div className="photo-top">
            <Camera size={30} />
            <strong>
              {remaining} of {MAX} uploads left
            </strong>
          </div>
          <form onSubmit={upload}>
            <label>
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Enter your name once"
              />
            </label>
            <label className="file-drop">
              <Upload size={25} />
              <span>Choose photos from your phone</span>
              <small>JPEG, PNG, WebP or HEIC · maximum 12 MB each</small>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={choose}
                disabled={loading || !remaining}
              />
            </label>
            {files.length > 0 && (
              <div className="previews">
                {files.map((f, i) => (
                  <div key={i}>
                    <span>{f.name}</span>
                    <small>{(f.size / 1024 / 1024).toFixed(1)} MB</small>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="error" role="alert">
                <AlertCircle size={15} /> {error}
              </p>
            )}
            {status && (
              <p className="notice">
                <CheckCircle2 size={16} /> {status}
              </p>
            )}
            <button
              type="submit"
              className="primary"
              disabled={
                loading ||
                !remaining ||
                !files.length ||
                !name.trim() ||
                !config
              }
            >
              {loading
                ? `Uploading ${progress + 1} of ${files.length}…`
                : `Upload ${files.length || ''} photo${files.length === 1 ? '' : 's'}`}
            </button>
          </form>
          <p className="upload-note">
            Uploads go to the couple's private photo collection. Please share
            only photos you have permission to upload. Uploads already recorded
            on this device: {saved.length}.
          </p>
          {config?.mode !== 's3' && (
            <p className="demo-warning">
              Photo uploads are not active yet. The hosts will enable their AWS
              S3 configuration before the celebration.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
