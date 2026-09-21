import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, Presentation } from 'lucide-react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { formatFileSize } from '../../utils/format.js';
import { deletePresentationAsset, fetchPresentationAssets, getPresentationAssetUrl, isPreviewableImage, uploadPresentationAsset } from './assetService.js';

export default function PresentationAssets({ category }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [cover, setCover] = useState(null);
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const slides = category === 'slide';
  const heading = slides ? 'Slides' : 'Photos & Graphics';
  const needsCover = slides && file && !isPreviewableImage(file);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setAssets(await fetchPresentationAssets(category)); setError(null); }
    catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [category]);
  useEffect(() => { reload(); }, [reload]);

  async function upload() {
    await uploadPresentationAsset({ category, title, description, file, cover });
    setTitle(''); setDescription(''); setFile(null); setCover(null);
    if (fileRef.current) fileRef.current.value = '';
    if (coverRef.current) coverRef.current.value = '';
    await reload();
  }
  async function open(asset) {
    const tab = window.open('about:blank', '_blank');
    if (!tab) { alert('Allow pop-ups to open this asset.'); return; }
    tab.opener = null;
    try { tab.location.href = await getPresentationAssetUrl(asset.storage_path); }
    catch (err) { tab.close(); alert(err.message); }
  }
  async function remove(asset) {
    if (!confirm(`Remove “${asset.title}” from the shared library?`)) return;
    try { await deletePresentationAsset(asset); await reload(); }
    catch (err) { alert(err.message); }
  }

  return <section className={`presentation-assets ${slides ? 'presentation-assets-slides' : 'presentation-assets-graphics'}`} aria-label={heading}>
    <div className="presentation-assets-heading"><div><h2 className="detail-section-title">{heading}</h2><p className="view-sub">{slides ? 'Keep the slides and decks you reuse across presentations in one visual library.' : 'Keep your frequently used photos and graphics ready for the next presentation.'}</p></div><span className="presentation-assets-count">{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</span></div>
    <div className="create-form-card presentation-asset-upload">
      <h3 className="card-title">Add to {heading}</h3>
      <div className="fields-grid">
        <label className="field-group half"><span className="field-label">Name</span><input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={slides ? 'e.g. Safety overview' : 'e.g. Field training photo'} /></label>
        <label className="field-group half"><span className="field-label">File</span><input ref={fileRef} className="field-input" type="file" accept={slides ? '.png,.jpg,.jpeg,.webp,.gif,.pdf,.ppt,.pptx' : '.png,.jpg,.jpeg,.webp,.gif'} onChange={(event) => { const selected = event.target.files?.[0] || null; setFile(selected); setCover(null); if (coverRef.current) coverRef.current.value = ''; if (selected) setTitle((current) => current || selected.name.replace(/\.[^.]+$/, '')); }} /></label>
        <label className="field-group full"><span className="field-label">Description (optional)</span><input className="field-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A note to help you find this later" /></label>
        {needsCover && <label className="field-group half"><span className="field-label">Thumbnail image</span><input ref={coverRef} className="field-input" type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={(event) => setCover(event.target.files?.[0] || null)} /><span className="field-hint">Add a cover image for this PDF or PowerPoint file.</span></label>}
      </div>
      <div className="create-form-actions"><SaveButton onSave={upload} label="Upload Asset" /></div>
    </div>
    {error ? <p className="empty-hint" role="alert">Couldn’t load {heading.toLowerCase()}. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></p> : loading ? <LoadingIndicator label={`Loading ${heading.toLowerCase()}…`} /> : assets.length ? <div className="presentation-asset-grid">{assets.map((asset) => <article className="presentation-asset-card" key={asset.id}>
      <button className="presentation-asset-preview" onClick={() => open(asset)} aria-label={`Open ${asset.title}`}>
        {asset.preview_url ? <img src={asset.preview_url} alt="" loading="lazy" /> : slides ? <Presentation size={44} aria-hidden="true" /> : <FileImage size={44} aria-hidden="true" />}
      </button>
      <div className="presentation-asset-info"><h3 title={asset.title}>{asset.title}</h3>{asset.description && <p>{asset.description}</p>}<span>{asset.file_name} · {formatFileSize(asset.file_size)}</span></div>
      <div className="presentation-asset-actions"><button className="btn-sm btn-sm-ghost" onClick={() => open(asset)}>Open ↗</button><button className="btn-sm btn-sm-danger" onClick={() => remove(asset)} aria-label={`Remove ${asset.title}`}>Remove</button></div>
    </article>)}</div> : <p className="empty-hint">No {heading.toLowerCase()} uploaded yet.</p>}
  </section>;
}
