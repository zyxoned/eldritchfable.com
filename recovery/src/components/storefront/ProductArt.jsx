import { useState } from 'react';
import { Package } from 'lucide-react';
export default function ProductArt({ product, detail = false }) {
  const [failed, setFailed] = useState(false);
  return <div className={`product-art${detail ? ' detail-art' : ''}`}>{product.image_url && !failed ? <img src={product.image_url} alt={product.name} loading={detail ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <><span>Image coming soon</span><Package aria-hidden="true" /></>}</div>;
}