import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
export default function Brand({ to = '/' }) {
  return <Link to={to} className="brand" aria-label="Eldritch Fable home"><span className="brand-mark" aria-hidden="true"><Sparkles /></span><span><strong>ELDRITCH</strong><em>FABLE</em></span></Link>;
}