import { Link } from 'react-router-dom';
import { useCatalog } from '@/lib/storefront-catalog';
export default function AvailabilityNotice() {
  const { products } = useCatalog();
  if (products.length && products.every(product => product.available)) return null;
  const someAvailable = products.some(product => product.available);
  return <aside className="availability-notice" aria-label="Product availability"><div><strong>{someAvailable ? 'Some items are temporarily unavailable.' : 'Items are temporarily unavailable.'}</strong><p>We’re sorry for the wait. We’re preparing stock and reliable shipping for the collection. Each item will become available when it’s ready. Thank you for your patience.</p></div><Link to="/contact">Contact us</Link></aside>;
}