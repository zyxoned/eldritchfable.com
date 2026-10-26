import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '@/lib/storefront-catalog';
import CatalogBrowser from '@/components/storefront/CatalogBrowser';
export default function Shop() {
  const { slug } = useParams(); const catalog = useCatalog();
  const collection = catalog.collections.find(c => c.slug === slug);
  if (slug && !collection && !catalog.loading) return <div className="ef-state"><h1>Collection not found.</h1><Link className="ef-button" to="/shop">Browse all products</Link></div>;
  return <><div className="ef-page"><p className="eyebrow">{collection ? 'The collection' : 'The full collection'}</p><h1>{collection?.name || 'Explore the archive.'}</h1>{collection?.description && <p className="ef-notice">{collection.description}</p>}</div><CatalogBrowser key={slug || 'all'} category={slug || ''} /></>;
}